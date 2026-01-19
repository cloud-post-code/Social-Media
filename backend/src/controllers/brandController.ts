import { Request, Response, NextFunction } from 'express';
import * as brandService from '../services/brandService.js';
import * as geminiService from '../services/geminiService.js';
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

    const extractedDNA = await geminiService.extractBrandDNA({ url, imageBase64 });
    res.json(extractedDNA);
  } catch (error: any) {
    console.error('Error in extractBrandDNA controller:', error);
    const errorMessage = error?.message || 'Failed to extract brand DNA';
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: { message: errorMessage }
    });
  }
};

export const uploadBrandImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ 
        error: { message: 'imageBase64 is required' } 
      });
    }

    const brand = await brandService.getBrandById(id);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }

    // Append new image to existing brand_images array (max 10 total)
    const currentImages = brand.brand_images || [];
    if (currentImages.length >= 10) {
      return res.status(400).json({ 
        error: { message: 'Maximum of 10 brand images allowed' } 
      });
    }

    const updatedImages = [...currentImages, imageBase64];
    const updatedBrand = await brandService.updateBrand(id, { 
      brand_images: updatedImages 
    });
    
    res.json(updatedBrand);
  } catch (error) {
    next(error);
  }
};

export const deleteBrandImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const imageIndex = parseInt(req.query.imageIndex as string, 10);
    
    if (isNaN(imageIndex) || imageIndex < 0) {
      return res.status(400).json({ 
        error: { message: 'Valid imageIndex query parameter is required' } 
      });
    }

    const brand = await brandService.getBrandById(id);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }

    const currentImages = brand.brand_images || [];
    if (imageIndex >= currentImages.length) {
      return res.status(400).json({ 
        error: { message: 'Invalid imageIndex' } 
      });
    }

    const updatedImages = currentImages.filter((_, index) => index !== imageIndex);
    const updatedBrand = await brandService.updateBrand(id, { 
      brand_images: updatedImages.length > 0 ? updatedImages : undefined
    });
    
    res.json(updatedBrand);
  } catch (error) {
    next(error);
  }
};

