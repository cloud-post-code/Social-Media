import { Request, Response, NextFunction } from 'express';
import * as brandService from '../services/brandService.js';
import * as geminiService from '../services/geminiService.js';
import * as brandAssetService from '../services/brandAssetService.js';
import { BrandDNA } from '../types/index.js';

export const getAllBrands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brands = await brandService.getAllBrands();
    res.json(brands);
  } catch (error) {
    next(error);
  }
};

export const getBrandById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const brand = await brandService.getBrandById(id);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }
    res.json(brand);
  } catch (error) {
    next(error);
  }
};

export const createBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brand = await brandService.createBrand(req.body);
    res.status(201).json(brand);
  } catch (error) {
    next(error);
  }
};

export const updateBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const brand = await brandService.updateBrand(id, req.body);
    res.json(brand);
  } catch (error) {
    next(error);
  }
};

export const deleteBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await brandService.deleteBrand(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const extractBrandDNA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, imageBase64 } = req.body;
    
    if (!url && !imageBase64) {
      return res.status(400).json({ 
        error: { message: 'Either url or imageBase64 must be provided' } 
      });
    }

    const extractedResult = await geminiService.extractBrandDNA({ url, imageBase64 });
    const extractedDNA = extractedResult as BrandDNA & { _extractedAssets?: { logoUrl?: string; imageUrls?: string[] } };
    
    // Extract assets info and remove from response
    const extractedAssets = extractedDNA._extractedAssets;
    delete (extractedDNA as any)._extractedAssets;
    
    // Return DNA with extracted assets info
    // Frontend will save assets to brand_assets table after creating/updating brand
    const response: any = { ...extractedDNA };
    if (extractedAssets) {
      response.extractedAssets = extractedAssets;
    }
    res.json(response);
  } catch (error: any) {
    console.error('Error in extractBrandDNA controller:', error);
    const errorMessage = error?.message || 'Failed to extract brand DNA';
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: { message: errorMessage }
    });
  }
};


