import { useState, useEffect } from 'react';
import { BrandAsset } from '../models/types.js';
import { brandAssetApi } from '../services/brandAssetApi.js';

export const useBrandAssets = (brandId?: string) => {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [logo, setLogo] = useState<BrandAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (brandId) {
      loadAssets();
    } else {
      setAssets([]);
      setLogo(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const loadAssets = async () => {
    if (!brandId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading assets for brand:', brandId);
      
      const [allAssets, logoAsset] = await Promise.all([
        brandAssetApi.getAssets(brandId, 'brand_image').catch((err) => {
          console.error('Error loading brand images:', err);
          return [];
        }),
        brandAssetApi.getLogo(brandId).catch((err) => {
          // Logo might not exist - that's ok
          if (err.message?.includes('404') || err.message?.includes('not found')) {
            return null;
          }
          console.error('Error loading logo:', err);
          return null;
        })
      ]);
      
      console.log('Loaded assets:', { 
        logo: logoAsset ? 'present' : 'none', 
        images: allAssets.length 
      });
      
      setAssets(allAssets || []);
      setLogo(logoAsset);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load assets';
      setError(errorMessage);
      console.error('Error in loadAssets:', err);
    } finally {
      setLoading(false);
    }
  };

  const uploadAsset = async (
    imageBase64: string,
    assetType: 'logo' | 'brand_image'
  ): Promise<BrandAsset> => {
    if (!brandId) {
      throw new Error('Brand ID is required');
    }
    
    try {
      const newAsset = await brandAssetApi.uploadAsset(brandId, imageBase64, assetType);
      
      if (assetType === 'logo') {
        setLogo(newAsset);
      } else {
        setAssets([...assets, newAsset]);
      }
      
      return newAsset;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to upload asset');
    }
  };

  const deleteAsset = async (assetId: string, assetType: 'logo' | 'brand_image'): Promise<void> => {
    if (!brandId) {
      throw new Error('Brand ID is required');
    }
    
    try {
      await brandAssetApi.deleteAsset(brandId, assetId);
      
      if (assetType === 'logo') {
        setLogo(null);
      } else {
        setAssets(assets.filter(a => a.id !== assetId));
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete asset');
    }
  };

  return {
    assets,
    logo,
    loading,
    error,
    loadAssets,
    uploadAsset,
    deleteAsset,
  };
};

