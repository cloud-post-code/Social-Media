import { api } from './api.js';
import { BrandAsset } from '../models/types.js';

export const brandAssetApi = {
  getAssets: (brandId: string, assetType?: 'logo' | 'brand_image') => {
    const url = `/brands/${brandId}/assets${assetType ? `?assetType=${assetType}` : ''}`;
    return api.get<BrandAsset[]>(url);
  },
  
  getLogo: (brandId: string) =>
    api.get<BrandAsset | null>(`/brands/${brandId}/assets/logo`),
  
  uploadAsset: (brandId: string, imageBase64: string, assetType: 'logo' | 'brand_image') =>
    api.post<BrandAsset>(`/brands/${brandId}/assets`, { imageBase64, assetType }),
  
  deleteAsset: (brandId: string, assetId: string) =>
    api.delete<void>(`/brands/${brandId}/assets/${assetId}`),
};

