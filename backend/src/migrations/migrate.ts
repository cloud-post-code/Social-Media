import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Running database migrations...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');
    
    console.log('Migrations completed successfully!');
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {}); // Ignore rollback errors
    // Check if error is because tables already exist (migrations already ran)
    if (error?.code === '42P07' || error?.message?.includes('already exists')) {
      console.log('Tables already exist, skipping migrations');
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

