import { Request, Response, NextFunction } from 'express';
import * as assetService from '../services/assetService.js';
import * as brandService from '../services/brandService.js';
import * as geminiService from '../services/geminiService.js';
import * as imageOverlayService from '../services/imageOverlayService.js';
import { BrandDNA, OverlayConfig } from '../types/index.js';
import sharp from 'sharp';

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
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const assets = await assetService.getAllAssets(brandId, limit);
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

    let baseImageUrl = await geminiService.generateImage(
      imagePromptResult.imagen_prompt_final,
      width || 1080,
      height || 1080,
      referenceImageBase64 // Pass reference image to Nano Banana
    );

    // Step 1.5: Verify product accuracy if reference image provided
    let verificationResult = null;
    if (referenceImageBase64) {
      const expectedAttributes = imagePromptResult.step_1_analysis?.reference_verification;
      verificationResult = await geminiService.verifyProductImageMatch(
        baseImageUrl,
        referenceImageBase64,
        productFocus,
        expectedAttributes ? {
          texture: expectedAttributes.extracted_texture,
          colors: expectedAttributes.extracted_colors,
          details: expectedAttributes.extracted_details,
          finish: expectedAttributes.extracted_finish
        } : undefined
      );

      // If match score is below 85, regenerate with enhanced prompt
      if (verificationResult.matchScore < 85 && verificationResult.recommendations.length > 0) {
        console.log(`[Product Verification] Match score ${verificationResult.matchScore} below threshold. Regenerating with improvements...`);
        console.log(`[Product Verification] Discrepancies: ${verificationResult.discrepancies.join('; ')}`);
        console.log(`[Product Verification] Recommendations: ${verificationResult.recommendations.join('; ')}`);

        // Enhance the prompt with specific recommendations
        const enhancedPrompt = `${imagePromptResult.imagen_prompt_final}\n\nCRITICAL CORRECTIONS NEEDED:\n${verificationResult.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}\n\nYou MUST address ALL these corrections. The product must match the reference exactly.`;

        baseImageUrl = await geminiService.generateImage(
          enhancedPrompt,
          width || 1080,
          height || 1080,
          referenceImageBase64 // Pass reference image to Nano Banana on retry
        );

        // Verify again
        verificationResult = await geminiService.verifyProductImageMatch(
          baseImageUrl,
          referenceImageBase64,
          productFocus,
          expectedAttributes ? {
            texture: expectedAttributes.extracted_texture,
            colors: expectedAttributes.extracted_colors,
            details: expectedAttributes.extracted_details,
            finish: expectedAttributes.extracted_finish
          } : undefined
        );

        console.log(`[Product Verification] After regeneration - Match score: ${verificationResult.matchScore}`);
      }

      if (verificationResult.matchScore < 70) {
        console.warn(`[Product Verification] WARNING: Match score ${verificationResult.matchScore} is still low. Product may not match reference accurately.`);
      }
    }

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
      step_1_5_verification: verificationResult ? {
        matches: verificationResult.matches,
        matchScore: verificationResult.matchScore,
        discrepancies: verificationResult.discrepancies,
        recommendations: verificationResult.recommendations,
        confidence: verificationResult.confidence
      } : null,
      step_2_title_subtitle: {
        title: titleSubtitle.title,
        subtitle: titleSubtitle.subtitle
      },
      step_3_overlay_design: {
        reasoning: overlayDesign.reasoning,
        overlay_config: overlayConfig
      }
    };

    // Generate unique ID: timestamp + random component to prevent collisions
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const asset = await assetService.createAsset({
      id: uniqueId,
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

    if (asset.type !== 'product' && asset.type !== 'non-product') {
      return res.status(400).json({ 
        error: { message: 'This endpoint is only for product and non-product assets' } 
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

    // Update strategy with new overlay config - handle different strategy structures
    let updatedStrategy;
    if (asset.type === 'product') {
      // Product posts have step_3_overlay_design
      updatedStrategy = {
        ...asset.strategy,
        step_3_overlay_design: {
          ...asset.strategy?.step_3_overlay_design,
          overlay_config: updatedOverlayConfig
        }
      };
    } else if (asset.type === 'non-product') {
      // Non-product posts have step_1_visual_concept and step_2_message_strategy
      // Preserve the entire strategy structure and add overlay_config to step_2_message_strategy
      updatedStrategy = {
        ...asset.strategy,
        step_2_message_strategy: {
          ...(asset.strategy?.step_2_message_strategy || {}),
          overlay_config: updatedOverlayConfig
        }
      };
    } else {
      // Fallback: preserve existing strategy
      updatedStrategy = asset.strategy;
    }

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
    const { brandId, userPurpose, useExactLogo, logoUrl, brandImageUrls } = req.body;

    if (!brandId || !userPurpose) {
      return res.status(400).json({ 
        error: { message: 'brandId and userPurpose are required' } 
      });
    }

    const brand = await brandService.getBrandById(brandId);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }

    const strategy = await geminiService.generateNonProductStrategy(
      brand, 
      userPurpose,
      useExactLogo ? logoUrl : undefined,
      brandImageUrls
    );

    if (!strategy?.step_1_visual_concept?.imagen_prompt_final) {
      throw new Error('Strategy generation failed to provide a prompt');
    }

    const baseImageUrl = await geminiService.generateImage(
      strategy.step_1_visual_concept.imagen_prompt_final
    );

    // Convert strategy message into overlay_config (similar to product posts)
    const messageStrategy = strategy.step_2_message_strategy;
    const designInstructions = messageStrategy?.design_instructions || {};
    const suggestedPosition = designInstructions.suggested_position || 'Center-Middle';
    
    // Parse position to get x/y percentages (matching product post logic)
    let titleXPercent = 50;
    let titleYPercent = 30;
    let textAnchor: 'start' | 'middle' | 'end' = 'middle';
    
    if (suggestedPosition.toLowerCase().includes('left')) {
      titleXPercent = 20;
      textAnchor = 'start';
    } else if (suggestedPosition.toLowerCase().includes('right')) {
      titleXPercent = 80;
      textAnchor = 'end';
    }
    
    if (suggestedPosition.toLowerCase().includes('top')) {
      titleYPercent = 30;
    } else if (suggestedPosition.toLowerCase().includes('bottom')) {
      titleYPercent = 80;
    }

    const subtitleYPercent = suggestedPosition.toLowerCase().includes('top') ? 70 : 80;

    // Create overlay config from strategy with improved readability
    const overlayConfig: OverlayConfig = {
      title: stripMarkdown(messageStrategy?.headline_text || ''),
      subtitle: stripMarkdown(messageStrategy?.body_caption_draft || ''),
      // Title properties - enhanced for readability
      title_font_family: 'sans-serif',
      title_font_weight: 'bold',
      title_font_size: 72, // Larger font size for readability
      title_font_transform: 'none',
      title_letter_spacing: 'normal',
      title_color_hex: designInstructions.suggested_text_color || '#FFFFFF',
      title_x_percent: titleXPercent,
      title_y_percent: titleYPercent,
      title_text_anchor: textAnchor,
      title_max_width_percent: 80,
      title_opacity: 1.0,
      // Add background for better readability
      title_overlay_background_type: 'solid',
      title_overlay_background_color: '#000000',
      title_overlay_background_opacity: 0.6,
      title_overlay_background_shape: 'rounded',
      title_overlay_background_padding: 16,
      // Subtitle properties - enhanced for readability
      subtitle_font_family: 'sans-serif',
      subtitle_font_weight: 'regular',
      subtitle_font_size: 48, // Larger font size for readability
      subtitle_font_transform: 'none',
      subtitle_letter_spacing: 'normal',
      subtitle_color_hex: designInstructions.suggested_text_color || '#FFFFFF',
      subtitle_x_percent: titleXPercent,
      subtitle_y_percent: subtitleYPercent,
      subtitle_text_anchor: textAnchor,
      subtitle_max_width_percent: 80,
      subtitle_opacity: 0.95,
      // Add background for better readability
      subtitle_overlay_background_type: 'solid',
      subtitle_overlay_background_color: '#000000',
      subtitle_overlay_background_opacity: 0.5,
      subtitle_overlay_background_shape: 'rounded',
      subtitle_overlay_background_padding: 12
    };

    // Apply overlay to image
    // Note: Logo overlay will be added in a future update
    const finalImageUrl = await imageOverlayService.applyTextOverlay(
      baseImageUrl,
      overlayConfig
    );

    // Generate unique ID: timestamp + random component to prevent collisions
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const asset = await assetService.createAsset({
      id: uniqueId,
      brand_id: brandId,
      type: 'non-product',
      image_url: finalImageUrl,
      base_image_url: baseImageUrl,
      overlay_config: overlayConfig,
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

    // Generate unique ID: timestamp + random component to prevent collisions
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const asset = await assetService.createAsset({
      id: uniqueId,
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

    // CRITICAL: Use base_image_url (clean image without overlay) for analysis and regeneration
    // Never use image_url (final image with overlay) for regeneration steps
    const baseImageForAnalysis = asset.base_image_url || asset.image_url;

    // Step 1: Analyze feedback to determine which step to redo
    const stepAnalysis = await geminiService.analyzeFeedbackForStepSelection(
      asset.type,
      asset.strategy,
      feedback,
      baseImageForAnalysis
    );

    console.log(`[Feedback Loop] Step selected: ${stepAnalysis.stepToRedo}, Reasoning: ${stepAnalysis.reasoning}, Confidence: ${stepAnalysis.confidence}`);

    let newBaseImageUrl = asset.base_image_url;
    let newOverlayConfig = asset.overlay_config;
    let newStrategy = { ...asset.strategy };
    let newTitleSubtitle = null;

    // Get brand DNA for regeneration
    const brand = await brandService.getBrandById(asset.brand_id);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }

    // Extract image dimensions from base image for regeneration
    let imageWidth = 1080;
    let imageHeight = 1080;
    try {
      if (baseImageForAnalysis) {
        const base64Data = baseImageForAnalysis.includes(',') 
          ? baseImageForAnalysis.split(',')[1] 
          : baseImageForAnalysis;
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const metadata = await sharp(imageBuffer).metadata();
        imageWidth = metadata.width || 1080;
        imageHeight = metadata.height || 1080;
      }
    } catch (error) {
      console.warn('[Feedback Loop] Failed to extract image dimensions, using defaults');
    }

    // Cascade regeneration based on step selection
    switch (stepAnalysis.stepToRedo) {
      case 'image_prompt': {
        // Regenerate prompt → regenerate image → regenerate text → regenerate overlay
        console.log('[Feedback Loop] Regenerating image prompt...');
        const imagePromptResult = await geminiService.regenerateImagePrompt(
          brand,
          asset.user_prompt || '',
          feedback,
          undefined // TODO: Get reference image from original generation if available
        );

        console.log('[Feedback Loop] Regenerating image...');
        newBaseImageUrl = await geminiService.regenerateImage(
          imagePromptResult.imagen_prompt_final,
          feedback,
          imageWidth,
          imageHeight,
          undefined // TODO: Get reference image from original generation if available
        );

        // Update strategy
        newStrategy.step_1_image_generation = {
          step_1_analysis: imagePromptResult.step_1_analysis,
          reasoning: imagePromptResult.reasoning,
          includes_person: imagePromptResult.includes_person,
          composition_notes: imagePromptResult.composition_notes,
          imagen_prompt_final: imagePromptResult.imagen_prompt_final
        };

        // Cascade: Regenerate text with new image
        console.log('[Feedback Loop] Regenerating title/subtitle...');
        newTitleSubtitle = await geminiService.regenerateTitleSubtitle(
          brand,
          asset.user_prompt || '',
          feedback,
          newBaseImageUrl // Use NEW base image
        );

        // Cascade: Regenerate overlay with new image and text
        console.log('[Feedback Loop] Regenerating overlay design...');
        const overlayDesign = await geminiService.regenerateOverlayDesign(
          brand,
          newTitleSubtitle.title,
          newTitleSubtitle.subtitle,
          feedback,
          newBaseImageUrl // Use NEW base image
        );

        // Build overlay config
        const titleYPercent = overlayDesign.position?.includes('top') ? 30 : 
                             overlayDesign.position?.includes('bottom') ? 20 : 30;
        const subtitleYPercent = overlayDesign.position?.includes('top') ? 70 : 
                                overlayDesign.position?.includes('bottom') ? 80 : 80;
        const xPercent = overlayDesign.position?.includes('left') ? 20 : 
                        overlayDesign.position?.includes('right') ? 80 : 50;

        newOverlayConfig = {
          title: stripMarkdown(newTitleSubtitle.title),
          subtitle: stripMarkdown(newTitleSubtitle.subtitle),
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

        // Update strategy
        newStrategy.step_2_title_subtitle = {
          title: newTitleSubtitle.title,
          subtitle: newTitleSubtitle.subtitle
        };
        newStrategy.step_3_overlay_design = {
          reasoning: overlayDesign.reasoning,
          overlay_config: newOverlayConfig
        };
        break;
      }

      case 'image_generation': {
        // Regenerate image → regenerate text → regenerate overlay
        console.log('[Feedback Loop] Regenerating image...');
        const currentPrompt = asset.strategy?.step_1_image_generation?.imagen_prompt_final || '';
        newBaseImageUrl = await geminiService.regenerateImage(
          currentPrompt,
          feedback,
          imageWidth,
          imageHeight,
          undefined // TODO: Get reference image from original generation if available
        );

        // Cascade: Regenerate text with new image
        console.log('[Feedback Loop] Regenerating title/subtitle...');
        newTitleSubtitle = await geminiService.regenerateTitleSubtitle(
          brand,
          asset.user_prompt || '',
          feedback,
          newBaseImageUrl // Use NEW base image
        );

        // Cascade: Regenerate overlay with new image and text
        console.log('[Feedback Loop] Regenerating overlay design...');
        const overlayDesign = await geminiService.regenerateOverlayDesign(
          brand,
          newTitleSubtitle.title,
          newTitleSubtitle.subtitle,
          feedback,
          newBaseImageUrl // Use NEW base image
        );

        // Build overlay config (same as image_prompt case)
        const titleYPercent = overlayDesign.position?.includes('top') ? 30 : 
                             overlayDesign.position?.includes('bottom') ? 20 : 30;
        const subtitleYPercent = overlayDesign.position?.includes('top') ? 70 : 
                                overlayDesign.position?.includes('bottom') ? 80 : 80;
        const xPercent = overlayDesign.position?.includes('left') ? 20 : 
                        overlayDesign.position?.includes('right') ? 80 : 50;

        newOverlayConfig = {
          title: stripMarkdown(newTitleSubtitle.title),
          subtitle: stripMarkdown(newTitleSubtitle.subtitle),
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

        // Update strategy
        newStrategy.step_2_title_subtitle = {
          title: newTitleSubtitle.title,
          subtitle: newTitleSubtitle.subtitle
        };
        newStrategy.step_3_overlay_design = {
          reasoning: overlayDesign.reasoning,
          overlay_config: newOverlayConfig
        };
        break;
      }

      case 'title_subtitle': {
        // Regenerate text → regenerate overlay (use CURRENT base image)
        console.log('[Feedback Loop] Regenerating title/subtitle...');
        newTitleSubtitle = await geminiService.regenerateTitleSubtitle(
          brand,
          asset.user_prompt || '',
          feedback,
          baseImageForAnalysis // Use CURRENT base image
        );

        // Cascade: Regenerate overlay with new text
        console.log('[Feedback Loop] Regenerating overlay design...');
        const overlayDesign = await geminiService.regenerateOverlayDesign(
          brand,
          newTitleSubtitle.title,
          newTitleSubtitle.subtitle,
          feedback,
          baseImageForAnalysis // Use CURRENT base image
        );

        // Build overlay config
        const titleYPercent = overlayDesign.position?.includes('top') ? 30 : 
                             overlayDesign.position?.includes('bottom') ? 20 : 30;
        const subtitleYPercent = overlayDesign.position?.includes('top') ? 70 : 
                                overlayDesign.position?.includes('bottom') ? 80 : 80;
        const xPercent = overlayDesign.position?.includes('left') ? 20 : 
                        overlayDesign.position?.includes('right') ? 80 : 50;

        newOverlayConfig = {
          title: stripMarkdown(newTitleSubtitle.title),
          subtitle: stripMarkdown(newTitleSubtitle.subtitle),
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

        // Update strategy
        newStrategy.step_2_title_subtitle = {
          title: newTitleSubtitle.title,
          subtitle: newTitleSubtitle.subtitle
        };
        newStrategy.step_3_overlay_design = {
          reasoning: overlayDesign.reasoning,
          overlay_config: newOverlayConfig
        };
        break;
      }

      case 'overlay_design': {
        // Regenerate overlay only (use CURRENT base image and CURRENT text)
        console.log('[Feedback Loop] Regenerating overlay design...');
        const currentTitle = asset.overlay_config?.title || '';
        const currentSubtitle = asset.overlay_config?.subtitle || '';
        
        const overlayDesign = await geminiService.regenerateOverlayDesign(
          brand,
          currentTitle,
          currentSubtitle,
          feedback,
          baseImageForAnalysis // Use CURRENT base image
        );

        // Build overlay config
        const titleYPercent = overlayDesign.position?.includes('top') ? 30 : 
                             overlayDesign.position?.includes('bottom') ? 20 : 30;
        const subtitleYPercent = overlayDesign.position?.includes('top') ? 70 : 
                                overlayDesign.position?.includes('bottom') ? 80 : 80;
        const xPercent = overlayDesign.position?.includes('left') ? 20 : 
                        overlayDesign.position?.includes('right') ? 80 : 50;

        newOverlayConfig = {
          title: asset.overlay_config?.title || '',
          subtitle: asset.overlay_config?.subtitle || '',
          ...asset.overlay_config,
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

        // Update strategy
        newStrategy.step_3_overlay_design = {
          reasoning: overlayDesign.reasoning,
          overlay_config: newOverlayConfig
        };
        break;
      }

      case 'final_image':
      default: {
        // Fallback to direct image editing
        console.log('[Feedback Loop] Falling back to direct image editing...');
        const imageToEdit = baseImageForAnalysis; // Use base image, not final image
        const newImageUrl = await geminiService.editImage(imageToEdit, feedback);
        
        // If we edited the base image, update it
        newBaseImageUrl = newImageUrl;
        
        // Reapply overlay if we have one
        if (asset.overlay_config) {
          const finalImageUrl = await imageOverlayService.applyTextOverlay(
            newBaseImageUrl,
            asset.overlay_config
          );
          newBaseImageUrl = finalImageUrl; // In this case, base becomes final since we edited it
        } else {
          newBaseImageUrl = newImageUrl;
        }
        break;
      }
    }

    // Apply overlay to create final image
    let finalImageUrl = newBaseImageUrl || asset.base_image_url || asset.image_url;
    if (newOverlayConfig && stepAnalysis.stepToRedo !== 'final_image' && newOverlayConfig.title && newOverlayConfig.subtitle) {
      const baseImageForOverlay = newBaseImageUrl || asset.base_image_url || asset.image_url;
      if (baseImageForOverlay) {
        finalImageUrl = await imageOverlayService.applyTextOverlay(
          baseImageForOverlay, // Always use base image for overlay application
          newOverlayConfig
        );
      }
    }

    // Track feedback iteration in strategy
    if (!newStrategy.feedback_iterations) {
      newStrategy.feedback_iterations = [];
    }
    newStrategy.feedback_iterations.push({
      feedback,
      step_redone: stepAnalysis.stepToRedo,
      reasoning: stepAnalysis.reasoning,
      confidence: stepAnalysis.confidence,
      timestamp: new Date().toISOString()
    });

    // Update asset
    const updatedAsset = await assetService.updateAsset(id, {
      image_url: finalImageUrl,
      base_image_url: newBaseImageUrl, // Update base_image_url if image was regenerated
      overlay_config: newOverlayConfig,
      strategy: newStrategy,
      feedback_history: [...(asset.feedback_history || []), feedback]
    });

    res.json(updatedAsset);
  } catch (error) {
    console.error('[Feedback Loop] Error:', error);
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

