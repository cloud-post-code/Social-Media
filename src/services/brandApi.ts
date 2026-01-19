import { api } from './api.js';
import { BrandDNA } from '../models/types.js';

export const brandApi = {
  getAll: () => api.get<BrandDNA[]>('/brands'),
  
  getById: (id: string) => api.get<BrandDNA>(`/brands/${id}`),
  
  create: (brand: BrandDNA) => api.post<BrandDNA>('/brands', brand),
  
  update: (id: string, brand: Partial<BrandDNA>) =>
    api.put<BrandDNA>(`/brands/${id}`, brand),
  
  delete: (id: string) => api.delete<void>(`/brands/${id}`),
  
  extractDNA: (input: { url?: string; imageBase64?: string; autoSave?: boolean }) =>
    api.post<BrandDNA & { extractedAssets?: { logoUrl?: string; imageUrls?: string[] } }>('/brands/extract', input),
  
  // Individual extraction steps
  extractBasicInfo: (data: { url?: string; imageBase64?: string }) =>
    api.post<{ name: string; tagline: string; overview: string }>('/brands/extract/basic-info', data),
  
  extractVisualIdentity: (data: { url?: string; imageBase64?: string }) =>
    api.post<{
      primary_color_hex: string;
      accent_color_hex: string;
      background_style: string;
      imagery_style: string;
      font_vibe: string;
      logo_style: string;
    }>('/brands/extract/visual-identity', data),
  
  extractBrandVoice: (data: { url?: string; imageBase64?: string }) =>
    api.post<{
      tone_adjectives: string[];
      writing_style: string;
      keywords_to_use: string[];
      taboo_words: string[];
    }>('/brands/extract/brand-voice', data),
  
  extractStrategicProfile: (data: { url?: string; imageBase64?: string }) =>
    api.post<{
      target_audience: string;
      core_value_prop: string;
      product_category: string;
    }>('/brands/extract/strategic-profile', data),
  
  extractBrandImages: (url: string) =>
    api.post<{ logoUrl?: string; imageUrls?: string[] }>('/brands/extract/images', { url }),
};

