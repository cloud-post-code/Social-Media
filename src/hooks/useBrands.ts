import { useState, useEffect } from 'react';
import { BrandDNA } from '../models/types.js';
import { brandApi } from '../services/brandApi.js';

export const useBrands = () => {
  const [brands, setBrands] = useState<BrandDNA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await brandApi.getAll();
      setBrands(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brands');
    } finally {
      setLoading(false);
    }
  };

  const createBrand = async (brand: BrandDNA) => {
    try {
      const newBrand = await brandApi.create(brand);
      setBrands([...brands, newBrand]);
      return newBrand;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create brand');
    }
  };

  const updateBrand = async (id: string, updates: Partial<BrandDNA>) => {
    try {
      const updated = await brandApi.update(id, updates);
      setBrands(brands.map(b => b.id === id ? updated : b));
      return updated;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update brand');
    }
  };

  const deleteBrand = async (id: string) => {
    try {
      await brandApi.delete(id);
      setBrands(brands.filter(b => b.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete brand');
    }
  };

  return {
    brands,
    loading,
    error,
    loadBrands,
    createBrand,
    updateBrand,
    deleteBrand,
  };
};

