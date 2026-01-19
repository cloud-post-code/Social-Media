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
  
  updateOverlay: (id: string, overlayConfig: {
    title?: string;
    subtitle?: string;
    font_family?: 'sans-serif' | 'serif' | 'cursive' | 'handwritten';
    font_weight?: 'light' | 'regular' | 'bold';
    font_transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
    letter_spacing?: 'normal' | 'wide';
    text_color_hex?: string;
    position?: 'top-center' | 'bottom-left' | 'bottom-right' | 'center-middle' | 'top-left' | 'top-right' | 'center-left' | 'center-right' | 'floating-center';
    max_width_percent?: number;
    opacity?: number;
    title_font_size?: number;
    subtitle_font_size?: number;
    title_max_lines?: number;
    subtitle_max_lines?: number;
  }) => api.put<GeneratedAsset>(`/assets/${id}/overlay`, { overlay_config: overlayConfig }),
  
  delete: (id: string) => api.delete<void>(`/assets/${id}`),
};

