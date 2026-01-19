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
    const { url, imageBase64, autoSave } = req.body; // autoSave option to create brand immediately
    
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
    
    // If autoSave is true, create the brand and save assets immediately
    if (autoSave) {
      // Create brand with extracted DNA
      const createdBrand = await brandService.createBrand(extractedDNA);
      
      // Save extracted assets to brand_assets table
      if (extractedAssets) {
        try {
          if (extractedAssets.logoUrl) {
            try {
              console.log(`[Extract] Saving logo: ${extractedAssets.logoUrl.substring(0, 100)}...`);
              await brandAssetService.createBrandAsset(createdBrand.id, extractedAssets.logoUrl, 'logo');
              console.log(`[Extract] Logo saved successfully`);
            } catch (err: any) {
              // Logo might already exist or conversion failed - log but continue
              console.error(`[Extract] Failed to save extracted logo:`, err.message);
              // Don't throw - brand is already created, just log the issue
            }
          }
          
          if (extractedAssets.imageUrls && extractedAssets.imageUrls.length > 0) {
            let savedCount = 0;
            for (const imageUrl of extractedAssets.imageUrls.slice(0, 10)) {
              try {
                console.log(`[Extract] Saving image ${savedCount + 1}/${Math.min(extractedAssets.imageUrls.length, 10)}: ${imageUrl.substring(0, 100)}...`);
                await brandAssetService.createBrandAsset(createdBrand.id, imageUrl, 'brand_image');
                savedCount++;
                console.log(`[Extract] Image ${savedCount} saved successfully`);
              } catch (err: any) {
                if (err.message?.includes('Maximum')) {
                  console.log(`[Extract] Reached maximum image limit`);
                  break; // Reached max limit
                }
                console.error(`[Extract] Failed to save extracted image:`, err.message);
                // Continue with next image
              }
            }
            console.log(`[Extract] Successfully saved ${savedCount} brand images`);
          }
        } catch (err) {
          console.error('[Extract] Error saving extracted assets:', err);
          // Continue even if asset saving fails - brand is already created
        }
      }
      
      // Return the created brand (assets are already saved)
      return res.json(createdBrand);
    }
    
    // Otherwise, return DNA with extracted assets info for frontend to save
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


