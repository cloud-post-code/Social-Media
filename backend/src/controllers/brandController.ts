import { Request, Response, NextFunction } from 'express';
import * as brandService from '../services/brandService.js';
import * as geminiService from '../services/geminiService.js';
import { BrandDNA } from '../types/index.js';

export const getAllBrands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brands = await brandService.getAllBrands();
    res.json(brands);
  } catch (error) {
    next(error);
  }
};

export const getBrandById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const brand = await brandService.getBrandById(id);
    if (!brand) {
      return res.status(404).json({ error: { message: 'Brand not found' } });
    }
    res.json(brand);
  } catch (error) {
    next(error);
  }
};

export const createBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brand = await brandService.createBrand(req.body);
    res.status(201).json(brand);
  } catch (error) {
    next(error);
  }
};

export const updateBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const brand = await brandService.updateBrand(id, req.body);
    res.json(brand);
  } catch (error) {
    next(error);
  }
};

export const deleteBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await brandService.deleteBrand(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const extractBrandDNA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, imageBase64 } = req.body;
    
    if (!url && !imageBase64) {
      return res.status(400).json({ 
        error: { message: 'Either url or imageBase64 must be provided' } 
      });
    }

    const extractedDNA = await geminiService.extractBrandDNA({ url, imageBase64 });
    res.json(extractedDNA);
  } catch (error) {
    next(error);
  }
};

