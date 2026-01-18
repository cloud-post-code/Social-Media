import { Request, Response, NextFunction } from 'express';
import * as assetService from '../services/assetService.js';
import * as brandService from '../services/brandService.js';
import * as geminiService from '../services/geminiService.js';
import { BrandDNA } from '../types/index.js';

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
    const { brandId, productFocus, referenceImageBase64 } = req.body;

    if (!brandId || !productFocus) {
      return res.status(400).json({ 
        error: { message: 'brandId and productFocus are required' } 
      });
    }

    const brand = await brandService.getBrandById(brandId);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }

    const strategy = await geminiService.generateProductStrategy(
      brand,
      productFocus,
      referenceImageBase64
    );

    if (!strategy?.step_1_visual_strategy?.imagen_prompt_final) {
      throw new Error('Strategy generation failed to provide a prompt');
    }

    const imageUrl = await geminiService.generateImage(
      strategy.step_1_visual_strategy.imagen_prompt_final
    );

    const asset = await assetService.createAsset({
      id: Date.now().toString(),
      brand_id: brandId,
      type: 'product',
      image_url: imageUrl,
      strategy,
      user_prompt: productFocus
    });

    res.status(201).json(asset);
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

