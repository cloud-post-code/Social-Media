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

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_generated_assets_brand_id ON generated_assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_created_at ON generated_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brands_created_at ON brands(created_at DESC);
`;

export async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Running database migrations...');
    
    await client.query('BEGIN');
    await client.query(schema);
    
    // Add brand_images column if it doesn't exist (for existing databases)
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
    
    await client.query('COMMIT');
    
    console.log('Migrations completed successfully!');
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {}); // Ignore rollback errors
    // Check if error is because tables already exist (migrations already ran)
    if (error?.code === '42P07' || error?.message?.includes('already exists')) {
      console.log('Tables already exist, applying incremental migrations...');
      // Try to add the column anyway
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
        console.log('Incremental migrations completed');
      } catch (alterError: any) {
        // Column might already exist, that's fine
        if (alterError?.code !== '42701') { // 42701 = duplicate_column
          console.error('Error adding brand_images column:', alterError);
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

