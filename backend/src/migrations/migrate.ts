import pool from '../config/database.js';

// Embedded SQL schema - no need to read from file
const schema = `
-- Brands table
CREATE TABLE IF NOT EXISTS brands (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tagline TEXT,
  overview TEXT,
  logo_url TEXT,
  brand_images JSONB,
  visual_identity JSONB NOT NULL,
  brand_voice JSONB NOT NULL,
  strategic_profile JSONB NOT NULL,
  image_generation_prompt_prefix TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated assets table
CREATE TABLE IF NOT EXISTS generated_assets (
  id VARCHAR(255) PRIMARY KEY,
  brand_id VARCHAR(255) NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('product', 'campaign', 'non-product')),
  image_url TEXT NOT NULL,
  campaign_images JSONB,
  strategy JSONB NOT NULL,
  user_prompt TEXT,
  feedback_history JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Brand assets table
CREATE TABLE IF NOT EXISTS brand_assets (
  id VARCHAR(255) PRIMARY KEY,
  brand_id VARCHAR(255) NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('logo', 'brand_image')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_generated_assets_brand_id ON generated_assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_created_at ON generated_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brands_created_at ON brands(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_assets_brand_id ON brand_assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_assets_asset_type ON brand_assets(asset_type);
`;

export async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Running database migrations...');
    
    await client.query('BEGIN');
    await client.query(schema);
    
    // Add brand_images column if it doesn't exist (for existing databases - deprecated but kept for migration)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'brands' AND column_name = 'brand_images'
        ) THEN
          ALTER TABLE brands ADD COLUMN brand_images JSONB;
        END IF;
      END $$;
    `);
    
    // Migrate existing logo_url and brand_images to brand_assets table
    await client.query(`
      DO $$
      DECLARE
        brand_record RECORD;
        logo_asset_id VARCHAR(255);
        image_url TEXT;
        image_index INTEGER;
      BEGIN
        -- Migrate logo_url to brand_assets
        FOR brand_record IN SELECT id, logo_url FROM brands WHERE logo_url IS NOT NULL AND logo_url != '' LOOP
          -- Check if logo already exists in brand_assets
          IF NOT EXISTS (
            SELECT 1 FROM brand_assets 
            WHERE brand_id = brand_record.id AND asset_type = 'logo'
          ) THEN
            logo_asset_id := 'logo_' || brand_record.id || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT;
            INSERT INTO brand_assets (id, brand_id, image_url, asset_type)
            VALUES (logo_asset_id, brand_record.id, brand_record.logo_url, 'logo');
          END IF;
        END LOOP;
        
        -- Migrate brand_images JSONB array to brand_assets
        FOR brand_record IN SELECT id, brand_images FROM brands WHERE brand_images IS NOT NULL LOOP
          IF jsonb_typeof(brand_record.brand_images) = 'array' THEN
            image_index := 0;
            FOR image_url IN SELECT jsonb_array_elements_text(brand_record.brand_images) LOOP
              -- Check if image already exists
              IF NOT EXISTS (
                SELECT 1 FROM brand_assets 
                WHERE brand_id = brand_record.id 
                AND asset_type = 'brand_image' 
                AND image_url = image_url
              ) THEN
                INSERT INTO brand_assets (id, brand_id, image_url, asset_type)
                VALUES (
                  'img_' || brand_record.id || '_' || image_index || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
                  brand_record.id,
                  image_url,
                  'brand_image'
                );
                image_index := image_index + 1;
              END IF;
            END LOOP;
          END IF;
        END LOOP;
      END $$;
    `);
    
    await client.query('COMMIT');
    
    console.log('Migrations completed successfully!');
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {}); // Ignore rollback errors
    // Check if error is because tables already exist (migrations already ran)
    if (error?.code === '42P07' || error?.message?.includes('already exists')) {
      console.log('Tables already exist, applying incremental migrations...');
      // Try to add the column and migrate data anyway
      try {
        await client.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'brands' AND column_name = 'brand_images'
            ) THEN
              ALTER TABLE brands ADD COLUMN brand_images JSONB;
            END IF;
          END $$;
        `);
        
        // Ensure brand_assets table exists
        await client.query(`
          CREATE TABLE IF NOT EXISTS brand_assets (
            id VARCHAR(255) PRIMARY KEY,
            brand_id VARCHAR(255) NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('logo', 'brand_image')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        
        // Create indexes if they don't exist
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_brand_assets_brand_id ON brand_assets(brand_id);
          CREATE INDEX IF NOT EXISTS idx_brand_assets_asset_type ON brand_assets(asset_type);
        `);
        
        // Migrate existing data
        await client.query(`
          DO $$
          DECLARE
            brand_record RECORD;
            logo_asset_id VARCHAR(255);
            image_url TEXT;
            image_index INTEGER;
          BEGIN
            -- Migrate logo_url to brand_assets
            FOR brand_record IN SELECT id, logo_url FROM brands WHERE logo_url IS NOT NULL AND logo_url != '' LOOP
              IF NOT EXISTS (
                SELECT 1 FROM brand_assets 
                WHERE brand_id = brand_record.id AND asset_type = 'logo'
              ) THEN
                logo_asset_id := 'logo_' || brand_record.id || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT;
                INSERT INTO brand_assets (id, brand_id, image_url, asset_type)
                VALUES (logo_asset_id, brand_record.id, brand_record.logo_url, 'logo');
              END IF;
            END LOOP;
            
            -- Migrate brand_images JSONB array to brand_assets
            FOR brand_record IN SELECT id, brand_images FROM brands WHERE brand_images IS NOT NULL LOOP
              IF jsonb_typeof(brand_record.brand_images) = 'array' THEN
                image_index := 0;
                FOR image_url IN SELECT jsonb_array_elements_text(brand_record.brand_images) LOOP
                  IF NOT EXISTS (
                    SELECT 1 FROM brand_assets 
                    WHERE brand_id = brand_record.id 
                    AND asset_type = 'brand_image' 
                    AND image_url = image_url
                  ) THEN
                    INSERT INTO brand_assets (id, brand_id, image_url, asset_type)
                    VALUES (
                      'img_' || brand_record.id || '_' || image_index || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
                      brand_record.id,
                      image_url,
                      'brand_image'
                    );
                    image_index := image_index + 1;
                  END IF;
                END LOOP;
              END IF;
            END LOOP;
          END $$;
        `);
        
        console.log('Incremental migrations completed');
      } catch (alterError: any) {
        // Column might already exist, that's fine
        if (alterError?.code !== '42701' && alterError?.code !== '42P07') { // 42701 = duplicate_column, 42P07 = duplicate_table
          console.error('Error in incremental migrations:', alterError);
        }
      }
      return; // Success - migrations already applied
    }
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    // Don't close the pool - server needs it!
  }
}

// Only run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });
}

