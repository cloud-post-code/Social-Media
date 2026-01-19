import pool from '../config/database.js';
import { BrandDNA, BrandRow } from '../types/index.js';

export const getAllBrands = async (): Promise<BrandDNA[]> => {
  const result = await pool.query<BrandRow>(
    'SELECT * FROM brands ORDER BY created_at DESC'
  );
  return result.rows.map(rowToBrandDNA);
};

export const getBrandById = async (id: string): Promise<BrandDNA | null> => {
  const result = await pool.query<BrandRow>(
    'SELECT * FROM brands WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return rowToBrandDNA(result.rows[0]);
};

export const createBrand = async (brand: BrandDNA): Promise<BrandDNA> => {
  const result = await pool.query<BrandRow>(
    `INSERT INTO brands (
      id, name, tagline, overview, logo_url, brand_images, visual_identity, 
      brand_voice, strategic_profile, image_generation_prompt_prefix
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      brand.id,
      brand.name,
      brand.tagline || null,
      brand.overview || null,
      brand.logo_url || null,
      brand.brand_images ? JSON.stringify(brand.brand_images) : null,
      JSON.stringify(brand.visual_identity),
      JSON.stringify(brand.brand_voice),
      JSON.stringify(brand.strategic_profile),
      '' // image_generation_prompt_prefix deprecated, always empty
    ]
  );
  return rowToBrandDNA(result.rows[0]);
};

export const updateBrand = async (id: string, brand: Partial<BrandDNA>): Promise<BrandDNA> => {
  const existing = await getBrandById(id);
  if (!existing) {
    throw new Error(`Brand with id ${id} not found`);
  }

  const updated = { ...existing, ...brand, updated_at: new Date() };
  
  const result = await pool.query<BrandRow>(
    `UPDATE brands SET
      name = $1, tagline = $2, overview = $3, logo_url = $4, brand_images = $5,
      visual_identity = $6, brand_voice = $7, strategic_profile = $8,
      image_generation_prompt_prefix = $9, updated_at = CURRENT_TIMESTAMP
    WHERE id = $10
    RETURNING *`,
    [
      updated.name,
      updated.tagline || null,
      updated.overview || null,
      updated.logo_url || null,
      updated.brand_images ? JSON.stringify(updated.brand_images) : null,
      JSON.stringify(updated.visual_identity),
      JSON.stringify(updated.brand_voice),
      JSON.stringify(updated.strategic_profile),
      '', // image_generation_prompt_prefix deprecated, always empty
      id
    ]
  );
  return rowToBrandDNA(result.rows[0]);
};

export const deleteBrand = async (id: string): Promise<void> => {
  const result = await pool.query('DELETE FROM brands WHERE id = $1', [id]);
  if (result.rowCount === 0) {
    throw new Error(`Brand with id ${id} not found`);
  }
};

function rowToBrandDNA(row: BrandRow): BrandDNA {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline || undefined,
    overview: row.overview || undefined,
    logo_url: row.logo_url || undefined,
    brand_images: row.brand_images && Array.isArray(row.brand_images) ? row.brand_images : undefined,
    visual_identity: row.visual_identity,
    brand_voice: row.brand_voice,
    strategic_profile: row.strategic_profile,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

