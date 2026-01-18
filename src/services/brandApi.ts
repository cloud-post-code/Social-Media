import { api } from './api.js';
import { BrandDNA } from '../models/types.js';

export const brandApi = {
  getAll: () => api.get<BrandDNA[]>('/brands'),
  
  getById: (id: string) => api.get<BrandDNA>(`/brands/${id}`),
  
  create: (brand: BrandDNA) => api.post<BrandDNA>('/brands', brand),
  
  update: (id: string, brand: Partial<BrandDNA>) =>
    api.put<BrandDNA>(`/brands/${id}`, brand),
  
  delete: (id: string) => api.delete<void>(`/brands/${id}`),
  
  extractDNA: (input: { url?: string; imageBase64?: string }) =>
    api.post<BrandDNA>('/brands/extract', input),
};

