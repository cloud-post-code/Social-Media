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
    setAssets([asset, ...assets]);
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

