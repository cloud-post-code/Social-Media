import { Request, Response, NextFunction } from 'express';
import * as brandService from '../services/brandService.js';
import * as brandAssetService from '../services/brandAssetService.js';

export const getBrandAssets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { assetType } = req.query;
    
    const brand = await brandService.getBrandById(id);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }
    
    const assets = await brandAssetService.getBrandAssets(
      id,
      assetType as 'logo' | 'brand_image' | undefined
    );
    
    res.json(assets);
  } catch (error) {
    next(error);
  }
};

export const getBrandLogo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const brand = await brandService.getBrandById(id);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }
    
    const logo = await brandAssetService.getBrandLogo(id);
    res.json(logo);
  } catch (error) {
    next(error);
  }
};

export const createBrandAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { imageBase64, assetType } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ 
        error: { message: 'imageBase64 is required' } 
      });
    }
    
    if (!assetType || !['logo', 'brand_image'].includes(assetType)) {
      return res.status(400).json({ 
        error: { message: 'assetType must be "logo" or "brand_image"' } 
      });
    }
    
    const brand = await brandService.getBrandById(id);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }
    
    const asset = await brandAssetService.createBrandAsset(
      id,
      imageBase64,
      assetType as 'logo' | 'brand_image'
    );
    
    res.status(201).json(asset);
  } catch (error: any) {
    if (error.message.includes('already has a logo') || error.message.includes('Maximum')) {
      return res.status(400).json({ error: { message: error.message } });
    }
    next(error);
  }
};

export const deleteBrandAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, assetId } = req.params;
    
    const brand = await brandService.getBrandById(id);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }
    
    await brandAssetService.deleteBrandAsset(assetId);
    res.status(204).send();
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message } });
    }
    next(error);
  }
};

