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
    width?: number;
    height?: number;
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
    // Title properties - completely separate
    title_font_family?: 'sans-serif' | 'serif' | 'cursive' | 'handwritten';
    title_font_weight?: 'light' | 'regular' | 'bold';
    title_font_transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
    title_letter_spacing?: 'normal' | 'wide';
    title_color_hex?: string;
    title_x_percent?: number;
    title_y_percent?: number;
    title_text_anchor?: 'start' | 'middle' | 'end';
    title_max_width_percent?: number;
    title_opacity?: number;
    title_font_size?: number;
    title_overlay_background_type?: 'gradient' | 'solid' | 'blur' | 'shape' | 'none';
    title_overlay_background_color?: string;
    title_overlay_background_opacity?: number;
    title_overlay_background_shape?: 'rectangle' | 'rounded' | 'pill' | 'circle';
    title_overlay_background_padding?: number;
    title_lines?: string[];
    // Subtitle properties - completely separate
    subtitle_font_family?: 'sans-serif' | 'serif' | 'cursive' | 'handwritten';
    subtitle_font_weight?: 'light' | 'regular' | 'bold';
    subtitle_font_transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
    subtitle_letter_spacing?: 'normal' | 'wide';
    subtitle_color_hex?: string;
    subtitle_x_percent?: number;
    subtitle_y_percent?: number;
    subtitle_text_anchor?: 'start' | 'middle' | 'end';
    subtitle_max_width_percent?: number;
    subtitle_opacity?: number;
    subtitle_font_size?: number;
    subtitle_overlay_background_type?: 'gradient' | 'solid' | 'blur' | 'shape' | 'none';
    subtitle_overlay_background_color?: string;
    subtitle_overlay_background_opacity?: number;
    subtitle_overlay_background_shape?: 'rectangle' | 'rounded' | 'pill' | 'circle';
    subtitle_overlay_background_padding?: number;
    subtitle_lines?: string[];
  }) => api.put<GeneratedAsset>(`/assets/${id}/overlay`, { overlay_config: overlayConfig }),
  
  delete: (id: string) => api.delete<void>(`/assets/${id}`),
};

