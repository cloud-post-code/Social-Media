import { Request, Response, NextFunction } from 'express';
import * as assetService from '../services/assetService.js';
import * as brandService from '../services/brandService.js';
import * as geminiService from '../services/geminiService.js';
import * as imageOverlayService from '../services/imageOverlayService.js';
import { BrandDNA, OverlayConfig } from '../types/index.js';

// Utility function to strip markdown syntax from text
const stripMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
    .replace(/\*(.*?)\*/g, '$1')       // Remove *italic*
    .replace(/__(.*?)__/g, '$1')       // Remove __bold__
    .replace(/_(.*?)_/g, '$1')         // Remove _italic_
    .replace(/~~(.*?)~~/g, '$1')       // Remove ~~strikethrough~~
    .replace(/`(.*?)`/g, '$1')         // Remove `code`
    .trim();
};

export const getAllAssets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brandId = req.query.brandId as string | undefined;
    const assets = await assetService.getAllAssets(brandId);
    res.json(assets);
  } catch (error) {
    next(error);
  }
};

export const getAssetById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const asset = await assetService.getAssetById(id);
    if (!asset) {
      return res.status(404).json({ error: { message: 'Asset not found' } });
    }
    res.json(asset);
  } catch (error) {
    next(error);
  }
};

export const generateProductAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { brandId, productFocus, referenceImageBase64, width, height } = req.body;

    if (!brandId || !productFocus) {
      return res.status(400).json({ 
        error: { message: 'brandId and productFocus are required' } 
      });
    }

    const brand = await brandService.getBrandById(brandId);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }

    // Step 1: Generate image prompt and create product image
    const imagePromptResult = await geminiService.generateProductImagePrompt(
      brand,
      productFocus,
      referenceImageBase64
    );

    if (!imagePromptResult.imagen_prompt_final) {
      throw new Error('Image prompt generation failed');
    }

    const baseImageUrl = await geminiService.generateImage(
      imagePromptResult.imagen_prompt_final,
      width || 1080,
      height || 1080
    );

    // Step 2: Generate title and subtitle
    const titleSubtitle = await geminiService.generateProductTitleSubtitle(
      brand,
      productFocus,
      baseImageUrl
    );

    if (!titleSubtitle.title || !titleSubtitle.subtitle) {
      throw new Error('Title/subtitle generation failed');
    }

    // Step 3: Design overlay strategy
    const overlayDesign = await geminiService.designTextOverlay(
      brand,
      titleSubtitle.title,
      titleSubtitle.subtitle,
      baseImageUrl
    );

    // Apply overlay to image - strip markdown before storing
    // Convert shared design to separate title and subtitle properties
    // Default positions: title at 30% from top, subtitle at 80% from top
    const titleYPercent = overlayDesign.position?.includes('top') ? 30 : 
                         overlayDesign.position?.includes('bottom') ? 20 : 30;
    const subtitleYPercent = overlayDesign.position?.includes('top') ? 70 : 
                            overlayDesign.position?.includes('bottom') ? 80 : 80;
    const xPercent = overlayDesign.position?.includes('left') ? 20 : 
                    overlayDesign.position?.includes('right') ? 80 : 50;
    
    const overlayConfig: OverlayConfig = {
      title: stripMarkdown(titleSubtitle.title),
      subtitle: stripMarkdown(titleSubtitle.subtitle),
      // Title properties - separate
      title_font_family: overlayDesign.font_family,
      title_font_weight: overlayDesign.font_weight,
      title_font_transform: overlayDesign.font_transform,
      title_letter_spacing: overlayDesign.letter_spacing,
      title_color_hex: overlayDesign.text_color_hex,
      title_x_percent: xPercent,
      title_y_percent: titleYPercent,
      title_text_anchor: overlayDesign.position?.includes('right') ? 'end' : 
                        overlayDesign.position?.includes('left') ? 'start' : 'middle',
      title_max_width_percent: overlayDesign.max_width_percent,
      title_opacity: overlayDesign.opacity,
      title_overlay_background_type: overlayDesign.overlay_background_type,
      title_overlay_background_color: overlayDesign.overlay_background_color,
      title_overlay_background_opacity: overlayDesign.overlay_background_opacity,
      title_overlay_background_shape: overlayDesign.overlay_background_shape,
      title_overlay_background_padding: overlayDesign.overlay_background_padding,
      // Subtitle properties - separate
      subtitle_font_family: overlayDesign.font_family,
      subtitle_font_weight: overlayDesign.font_weight === 'bold' ? 'regular' : overlayDesign.font_weight,
      subtitle_font_transform: overlayDesign.font_transform,
      subtitle_letter_spacing: overlayDesign.letter_spacing,
      subtitle_color_hex: overlayDesign.text_color_hex,
      subtitle_x_percent: xPercent,
      subtitle_y_percent: subtitleYPercent,
      subtitle_text_anchor: overlayDesign.position?.includes('right') ? 'end' : 
                            overlayDesign.position?.includes('left') ? 'start' : 'middle',
      subtitle_max_width_percent: overlayDesign.max_width_percent,
      subtitle_opacity: overlayDesign.opacity * 0.9,
      subtitle_overlay_background_type: overlayDesign.overlay_background_type,
      subtitle_overlay_background_color: overlayDesign.overlay_background_color,
      subtitle_overlay_background_opacity: overlayDesign.overlay_background_opacity,
      subtitle_overlay_background_shape: overlayDesign.overlay_background_shape,
      subtitle_overlay_background_padding: overlayDesign.overlay_background_padding
    };

    const finalImageUrl = await imageOverlayService.applyTextOverlay(
      baseImageUrl,
      overlayConfig
    );

    // Store strategy information
    const strategy = {
      step_1_image_generation: {
        step_1_analysis: imagePromptResult.step_1_analysis,
        reasoning: imagePromptResult.reasoning,
        includes_person: imagePromptResult.includes_person,
        composition_notes: imagePromptResult.composition_notes,
        imagen_prompt_final: imagePromptResult.imagen_prompt_final
      },
      step_2_title_subtitle: {
        title: titleSubtitle.title,
        subtitle: titleSubtitle.subtitle
      },
      step_3_overlay_design: {
        reasoning: overlayDesign.reasoning,
        overlay_config: overlayConfig
      }
    };

    const asset = await assetService.createAsset({
      id: Date.now().toString(),
      brand_id: brandId,
      type: 'product',
      image_url: finalImageUrl,
      base_image_url: baseImageUrl,
      overlay_config: overlayConfig,
      strategy,
      user_prompt: productFocus
    });

    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
};

/**
 * Update product overlay (colors, text, typography)
 */
export const updateProductOverlay = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { overlay_config } = req.body;

    if (!overlay_config) {
      return res.status(400).json({ 
        error: { message: 'overlay_config is required' } 
      });
    }

    const asset = await assetService.getAssetById(id);
    if (!asset) {
      return res.status(404).json({ error: { message: 'Asset not found' } });
    }

    if (asset.type !== 'product') {
      return res.status(400).json({ 
        error: { message: 'This endpoint is only for product assets' } 
      });
    }

    // Use base image if available, otherwise use current image
    const baseImage = asset.base_image_url || asset.image_url;
    
    // Get existing config or use defaults
    const existing = asset.overlay_config;
    
    // Strip markdown from title and subtitle before storing
    const updatedOverlayConfig: OverlayConfig = {
      title: stripMarkdown(overlay_config.title !== undefined ? overlay_config.title : (existing?.title || '')),
      subtitle: stripMarkdown(overlay_config.subtitle !== undefined ? overlay_config.subtitle : (existing?.subtitle || '')),
      // Title properties - completely separate
      title_font_family: overlay_config.title_font_family !== undefined ? overlay_config.title_font_family : (existing?.title_font_family || 'sans-serif'),
      title_font_weight: overlay_config.title_font_weight !== undefined ? overlay_config.title_font_weight : (existing?.title_font_weight || 'bold'),
      title_font_transform: overlay_config.title_font_transform !== undefined ? overlay_config.title_font_transform : (existing?.title_font_transform || 'none'),
      title_letter_spacing: overlay_config.title_letter_spacing !== undefined ? overlay_config.title_letter_spacing : (existing?.title_letter_spacing || 'normal'),
      title_color_hex: overlay_config.title_color_hex !== undefined ? overlay_config.title_color_hex : (existing?.title_color_hex || '#FFFFFF'),
      title_x_percent: overlay_config.title_x_percent !== undefined ? overlay_config.title_x_percent : (existing?.title_x_percent || 50),
      title_y_percent: overlay_config.title_y_percent !== undefined ? overlay_config.title_y_percent : (existing?.title_y_percent || 30),
      title_text_anchor: overlay_config.title_text_anchor !== undefined ? overlay_config.title_text_anchor : (existing?.title_text_anchor || 'middle'),
      title_max_width_percent: overlay_config.title_max_width_percent !== undefined ? overlay_config.title_max_width_percent : (existing?.title_max_width_percent || 80),
      title_opacity: overlay_config.title_opacity !== undefined ? overlay_config.title_opacity : (existing?.title_opacity !== undefined ? existing.title_opacity : 1.0),
      title_font_size: overlay_config.title_font_size !== undefined ? overlay_config.title_font_size : existing?.title_font_size,
      title_overlay_background_type: overlay_config.title_overlay_background_type !== undefined ? overlay_config.title_overlay_background_type : existing?.title_overlay_background_type,
      title_overlay_background_color: overlay_config.title_overlay_background_color !== undefined ? overlay_config.title_overlay_background_color : existing?.title_overlay_background_color,
      title_overlay_background_opacity: overlay_config.title_overlay_background_opacity !== undefined ? overlay_config.title_overlay_background_opacity : existing?.title_overlay_background_opacity,
      title_overlay_background_shape: overlay_config.title_overlay_background_shape !== undefined ? overlay_config.title_overlay_background_shape : existing?.title_overlay_background_shape,
      title_overlay_background_padding: overlay_config.title_overlay_background_padding !== undefined ? overlay_config.title_overlay_background_padding : existing?.title_overlay_background_padding,
      // Subtitle properties - completely separate
      subtitle_font_family: overlay_config.subtitle_font_family !== undefined ? overlay_config.subtitle_font_family : (existing?.subtitle_font_family || 'sans-serif'),
      subtitle_font_weight: overlay_config.subtitle_font_weight !== undefined ? overlay_config.subtitle_font_weight : (existing?.subtitle_font_weight || 'regular'),
      subtitle_font_transform: overlay_config.subtitle_font_transform !== undefined ? overlay_config.subtitle_font_transform : (existing?.subtitle_font_transform || 'none'),
      subtitle_letter_spacing: overlay_config.subtitle_letter_spacing !== undefined ? overlay_config.subtitle_letter_spacing : (existing?.subtitle_letter_spacing || 'normal'),
      subtitle_color_hex: overlay_config.subtitle_color_hex !== undefined ? overlay_config.subtitle_color_hex : (existing?.subtitle_color_hex || '#FFFFFF'),
      subtitle_x_percent: overlay_config.subtitle_x_percent !== undefined ? overlay_config.subtitle_x_percent : (existing?.subtitle_x_percent || 50),
      subtitle_y_percent: overlay_config.subtitle_y_percent !== undefined ? overlay_config.subtitle_y_percent : (existing?.subtitle_y_percent || 80),
      subtitle_text_anchor: overlay_config.subtitle_text_anchor !== undefined ? overlay_config.subtitle_text_anchor : (existing?.subtitle_text_anchor || 'middle'),
      subtitle_max_width_percent: overlay_config.subtitle_max_width_percent !== undefined ? overlay_config.subtitle_max_width_percent : (existing?.subtitle_max_width_percent || 80),
      subtitle_opacity: overlay_config.subtitle_opacity !== undefined ? overlay_config.subtitle_opacity : (existing?.subtitle_opacity !== undefined ? existing.subtitle_opacity : 0.9),
      subtitle_font_size: overlay_config.subtitle_font_size !== undefined ? overlay_config.subtitle_font_size : existing?.subtitle_font_size,
      subtitle_overlay_background_type: overlay_config.subtitle_overlay_background_type !== undefined ? overlay_config.subtitle_overlay_background_type : existing?.subtitle_overlay_background_type,
      subtitle_overlay_background_color: overlay_config.subtitle_overlay_background_color !== undefined ? overlay_config.subtitle_overlay_background_color : existing?.subtitle_overlay_background_color,
      subtitle_overlay_background_opacity: overlay_config.subtitle_overlay_background_opacity !== undefined ? overlay_config.subtitle_overlay_background_opacity : existing?.subtitle_overlay_background_opacity,
      subtitle_overlay_background_shape: overlay_config.subtitle_overlay_background_shape !== undefined ? overlay_config.subtitle_overlay_background_shape : existing?.subtitle_overlay_background_shape,
      subtitle_overlay_background_padding: overlay_config.subtitle_overlay_background_padding !== undefined ? overlay_config.subtitle_overlay_background_padding : existing?.subtitle_overlay_background_padding
    };

    const finalImageUrl = await imageOverlayService.updateOverlay(
      baseImage,
      updatedOverlayConfig
    );

    // Update strategy with new overlay config
    const updatedStrategy = {
      ...asset.strategy,
      step_3_overlay_design: {
        ...asset.strategy?.step_3_overlay_design,
        overlay_config: updatedOverlayConfig
      }
    };

    const updatedAsset = await assetService.updateAsset(id, {
      image_url: finalImageUrl,
      overlay_config: updatedOverlayConfig,
      strategy: updatedStrategy
    });

    res.json(updatedAsset);
  } catch (error) {
    next(error);
  }
};

export const generateNonProductAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { brandId, userPurpose } = req.body;

    if (!brandId || !userPurpose) {
      return res.status(400).json({ 
        error: { message: 'brandId and userPurpose are required' } 
      });
    }

    const brand = await brandService.getBrandById(brandId);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }

    const strategy = await geminiService.generateNonProductStrategy(brand, userPurpose);

    if (!strategy?.step_1_visual_concept?.imagen_prompt_final) {
      throw new Error('Strategy generation failed to provide a prompt');
    }

    const imageUrl = await geminiService.generateImage(
      strategy.step_1_visual_concept.imagen_prompt_final
    );

    const asset = await assetService.createAsset({
      id: Date.now().toString(),
      brand_id: brandId,
      type: 'non-product',
      image_url: imageUrl,
      strategy,
      user_prompt: userPurpose
    });

    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
};

export const generateCampaignAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { brandId, campaignDetails, postCount } = req.body;

    if (!brandId || !campaignDetails || !postCount) {
      return res.status(400).json({ 
        error: { message: 'brandId, campaignDetails, and postCount are required' } 
      });
    }

    const brand = await brandService.getBrandById(brandId);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }

    const campaignStrategy = await geminiService.generateCampaignStrategy(
      brand,
      campaignDetails,
      postCount
    );

    const campaignImages = await Promise.all(
      (campaignStrategy.posts || []).map((p: any) => 
        geminiService.generateImage(p.visual_prompt)
      )
    );

    const asset = await assetService.createAsset({
      id: Date.now().toString(),
      brand_id: brandId,
      type: 'campaign',
      image_url: campaignImages[0],
      campaign_images: campaignImages,
      strategy: campaignStrategy,
      user_prompt: campaignDetails
    });

    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
};

export const editAssetImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      return res.status(400).json({ 
        error: { message: 'feedback is required' } 
      });
    }

    const asset = await assetService.getAssetById(id);
    if (!asset) {
      return res.status(404).json({ error: { message: 'Asset not found' } });
    }

    const newImageUrl = await geminiService.editImage(asset.image_url, feedback);

    const updatedAsset = await assetService.updateAsset(id, {
      image_url: newImageUrl,
      feedback_history: [...(asset.feedback_history || []), feedback]
    });

    res.json(updatedAsset);
  } catch (error) {
    next(error);
  }
};

export const deleteAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await assetService.deleteAsset(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

