import { useState, useEffect } from 'react';
import { GeneratedAsset } from '../models/types.js';
import { assetApi } from '../services/assetApi.js';

export const useAssets = (brandId?: string) => {
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAssets();
  }, [brandId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await assetApi.getAll(brandId);
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const createAsset = async (asset: GeneratedAsset) => {
    // Ensure asset has required fields
    if (!asset.id) {
      console.error('Asset missing ID:', asset);
      return asset;
    }
    
    // Add new asset to the beginning of the list
    // Use functional update to ensure we have the latest state
    setAssets(prevAssets => {
      // Check if asset with this ID already exists to prevent duplicates
      const existingIndex = prevAssets.findIndex(a => a.id === asset.id);
      if (existingIndex >= 0) {
        // Update existing asset instead of adding duplicate
        return prevAssets.map((a, i) => i === existingIndex ? asset : a);
      }
      // Add new asset to the beginning of the list
      return [asset, ...prevAssets];
    });
    return asset;
  };

  const updateAsset = async (id: string, feedback: string) => {
    try {
      const updated = await assetApi.editImage(id, feedback);
      setAssets(assets.map(a => a.id === id ? updated : a));
      return updated;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update asset');
    }
  };

  const deleteAsset = async (id: string) => {
    try {
      await assetApi.delete(id);
      setAssets(assets.filter(a => a.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete asset');
    }
  };

  return {
    assets,
    loading,
    error,
    loadAssets,
    createAsset,
    updateAsset,
    deleteAsset,
  };
};

