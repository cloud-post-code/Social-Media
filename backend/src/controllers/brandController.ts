import { Request, Response, NextFunction } from 'express';
import * as brandService from '../services/brandService.js';
import * as geminiService from '../services/geminiService.js';
import * as brandAssetService from '../services/brandAssetService.js';
import { BrandDNA } from '../types/index.js';

// Individual extraction step controllers
export const extractBasicInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, imageBase64 } = req.body;
    
    if (!url && !imageBase64) {
      return res.status(400).json({ 
        error: { message: 'Either url or imageBase64 must be provided' } 
      });
    }

    const result = await geminiService.extractBasicInfo({ url, imageBase64 });
    res.json(result);
  } catch (error: any) {
    console.error('Error in extractBasicInfo:', error);
    res.status(500).json({
      error: { message: error?.message || 'Failed to extract basic info' }
    });
  }
};

export const extractVisualIdentity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, imageBase64 } = req.body;
    
    if (!url && !imageBase64) {
      return res.status(400).json({ 
        error: { message: 'Either url or imageBase64 must be provided' } 
      });
    }

    const result = await geminiService.extractVisualIdentity({ url, imageBase64 });
    res.json(result);
  } catch (error: any) {
    console.error('Error in extractVisualIdentity:', error);
    res.status(500).json({
      error: { message: error?.message || 'Failed to extract visual identity' }
    });
  }
};

export const extractBrandVoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, imageBase64 } = req.body;
    
    if (!url && !imageBase64) {
      return res.status(400).json({ 
        error: { message: 'Either url or imageBase64 must be provided' } 
      });
    }

    const result = await geminiService.extractBrandVoice({ url, imageBase64 });
    res.json(result);
  } catch (error: any) {
    console.error('Error in extractBrandVoice:', error);
    res.status(500).json({
      error: { message: error?.message || 'Failed to extract brand voice' }
    });
  }
};

export const extractStrategicProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, imageBase64 } = req.body;
    
    if (!url && !imageBase64) {
      return res.status(400).json({ 
        error: { message: 'Either url or imageBase64 must be provided' } 
      });
    }

    const result = await geminiService.extractStrategicProfile({ url, imageBase64 });
    res.json(result);
  } catch (error: any) {
    console.error('Error in extractStrategicProfile:', error);
    res.status(500).json({
      error: { message: error?.message || 'Failed to extract strategic profile' }
    });
  }
};

export const extractBrandImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body;
    
    console.log('[Extract Images] Received request:', { url: url?.substring(0, 100) });
    
    if (!url) {
      console.error('[Extract Images] Missing URL in request body');
      return res.status(400).json({ 
        error: { message: 'URL is required for image extraction' } 
      });
    }

    console.log('[Extract Images] Calling geminiService.extractBrandImages...');
    const result = await geminiService.extractBrandImages(url);
    console.log('[Extract Images] Extraction result:', {
      hasLogo: !!result.logoUrl,
      logoUrl: result.logoUrl?.substring(0, 100),
      imageCount: result.imageUrls?.length || 0,
      imageUrls: result.imageUrls?.slice(0, 3).map((u: string) => u.substring(0, 100))
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[Extract Images] Error:', error);
    console.error('[Extract Images] Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    res.status(500).json({
      error: { message: error?.message || 'Failed to extract brand images' }
    });
  }
};

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
      try {
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
                console.error(`[Extract] Failed to save extracted logo:`, err.message);
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
                    break;
                  }
                  console.error(`[Extract] Failed to save extracted image:`, err.message);
                }
              }
              console.log(`[Extract] Successfully saved ${savedCount} brand images`);
            }
          } catch (err) {
            console.error('[Extract] Error saving extracted assets:', err);
          }
        }
        
        return res.json(createdBrand);
      } catch (createErr: any) {
        // If duplicate key error, try to update existing brand instead
        if (createErr.message?.includes('duplicate key') || createErr.code === '23505') {
          console.log(`[Extract] Brand ${extractedDNA.id} already exists, updating instead`);
          try {
            const updatedBrand = await brandService.updateBrand(extractedDNA.id, extractedDNA);
            
            // Still try to save assets even if brand already existed
            if (extractedAssets) {
              try {
                if (extractedAssets.logoUrl) {
                  try {
                    await brandAssetService.createBrandAsset(updatedBrand.id, extractedAssets.logoUrl, 'logo');
                  } catch (err: any) {
                    if (!err.message?.includes('already has a logo')) {
                      console.error(`[Extract] Failed to save logo:`, err.message);
                    }
                  }
                }
                
                if (extractedAssets.imageUrls && extractedAssets.imageUrls.length > 0) {
                  for (const imageUrl of extractedAssets.imageUrls.slice(0, 10)) {
                    try {
                      await brandAssetService.createBrandAsset(updatedBrand.id, imageUrl, 'brand_image');
                    } catch (err: any) {
                      if (!err.message?.includes('Maximum')) {
                        console.error(`[Extract] Failed to save image:`, err.message);
                      }
                    }
                  }
                }
              } catch (err) {
                console.error('[Extract] Error saving assets for existing brand:', err);
              }
            }
            
            return res.json(updatedBrand);
          } catch (updateErr) {
            console.error('[Extract] Failed to update existing brand:', updateErr);
            throw updateErr;
          }
        }
        throw createErr;
      }
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


