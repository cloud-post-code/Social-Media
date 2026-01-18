import { api } from './api.js';
import { GeneratedAsset } from '../models/types.js';

export const assetApi = {
  getAll: (brandId?: string) => {
    const query = brandId ? `?brandId=${brandId}` : '';
    return api.get<GeneratedAsset[]>(`/assets${query}`);
  },
  
  getById: (id: string) => api.get<GeneratedAsset>(`/assets/${id}`),
  
  generateProduct: (data: {
    brandId: string;
    productFocus: string;
    referenceImageBase64?: string;
  }) => api.post<GeneratedAsset>('/assets/generate/product', data),
  
  generateNonProduct: (data: {
    brandId: string;
    userPurpose: string;
  }) => api.post<GeneratedAsset>('/assets/generate/non-product', data),
  
  generateCampaign: (data: {
    brandId: string;
    campaignDetails: string;
    postCount: number;
  }) => api.post<GeneratedAsset>('/assets/generate/campaign', data),
  
  editImage: (id: string, feedback: string) =>
    api.put<GeneratedAsset>(`/assets/${id}/edit`, { feedback }),
  
  delete: (id: string) => api.delete<void>(`/assets/${id}`),
};

