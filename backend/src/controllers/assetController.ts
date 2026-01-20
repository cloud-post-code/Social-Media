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
    const overlayConfig: OverlayConfig = {
      title: stripMarkdown(titleSubtitle.title),
      subtitle: stripMarkdown(titleSubtitle.subtitle),
      font_family: overlayDesign.font_family,
      font_weight: overlayDesign.font_weight,
      font_transform: overlayDesign.font_transform,
      letter_spacing: overlayDesign.letter_spacing,
      text_color_hex: overlayDesign.text_color_hex,
      position: overlayDesign.position,
      max_width_percent: overlayDesign.max_width_percent,
      opacity: overlayDesign.opacity
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
    
    // Strip markdown from title and subtitle before storing
    const updatedOverlayConfig: OverlayConfig = {
      title: stripMarkdown(overlay_config.title || asset.overlay_config?.title || asset.overlay_config?.text || ''),
      subtitle: stripMarkdown(overlay_config.subtitle || asset.overlay_config?.subtitle || ''),
      font_family: overlay_config.font_family || asset.overlay_config?.font_family || 'sans-serif',
      font_weight: overlay_config.font_weight || asset.overlay_config?.font_weight || 'bold',
      font_transform: overlay_config.font_transform || asset.overlay_config?.font_transform || 'none',
      letter_spacing: overlay_config.letter_spacing || asset.overlay_config?.letter_spacing || 'normal',
      text_color_hex: overlay_config.text_color_hex || asset.overlay_config?.text_color_hex || '#FFFFFF', // Legacy
      title_color_hex: overlay_config.title_color_hex !== undefined ? overlay_config.title_color_hex : (asset.overlay_config?.title_color_hex || overlay_config.text_color_hex || asset.overlay_config?.text_color_hex || '#FFFFFF'),
      subtitle_color_hex: overlay_config.subtitle_color_hex !== undefined ? overlay_config.subtitle_color_hex : (asset.overlay_config?.subtitle_color_hex || overlay_config.text_color_hex || asset.overlay_config?.text_color_hex || '#FFFFFF'),
      max_width_percent: overlay_config.max_width_percent || asset.overlay_config?.max_width_percent || 80,
      opacity: overlay_config.opacity !== undefined ? overlay_config.opacity : (asset.overlay_config?.opacity !== undefined ? asset.overlay_config.opacity : 1.0),
      title_font_size: overlay_config.title_font_size !== undefined ? overlay_config.title_font_size : asset.overlay_config?.title_font_size,
      subtitle_font_size: overlay_config.subtitle_font_size !== undefined ? overlay_config.subtitle_font_size : asset.overlay_config?.subtitle_font_size,
      title_max_lines: overlay_config.title_max_lines !== undefined ? overlay_config.title_max_lines : (asset.overlay_config?.title_max_lines || 3),
      subtitle_max_lines: overlay_config.subtitle_max_lines !== undefined ? overlay_config.subtitle_max_lines : (asset.overlay_config?.subtitle_max_lines || 3),
      x_percent: overlay_config.x_percent !== undefined ? overlay_config.x_percent : asset.overlay_config?.x_percent,
      y_percent: overlay_config.y_percent !== undefined ? overlay_config.y_percent : asset.overlay_config?.y_percent,
      // Separate positioning for title and subtitle
      title_x_percent: overlay_config.title_x_percent !== undefined ? overlay_config.title_x_percent : asset.overlay_config?.title_x_percent,
      title_y_percent: overlay_config.title_y_percent !== undefined ? overlay_config.title_y_percent : asset.overlay_config?.title_y_percent,
      subtitle_x_percent: overlay_config.subtitle_x_percent !== undefined ? overlay_config.subtitle_x_percent : asset.overlay_config?.subtitle_x_percent,
      subtitle_y_percent: overlay_config.subtitle_y_percent !== undefined ? overlay_config.subtitle_y_percent : asset.overlay_config?.subtitle_y_percent,
      text_anchor: overlay_config.text_anchor || asset.overlay_config?.text_anchor || 'middle',
      title_text_anchor: overlay_config.title_text_anchor !== undefined ? overlay_config.title_text_anchor : (asset.overlay_config?.title_text_anchor || overlay_config.text_anchor || asset.overlay_config?.text_anchor || 'middle'),
      subtitle_text_anchor: overlay_config.subtitle_text_anchor !== undefined ? overlay_config.subtitle_text_anchor : (asset.overlay_config?.subtitle_text_anchor || overlay_config.text_anchor || asset.overlay_config?.text_anchor || 'middle'),
      position: overlay_config.position || asset.overlay_config?.position || 'bottom-right' // Keep for backward compatibility
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

