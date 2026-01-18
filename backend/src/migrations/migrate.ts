import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Running database migrations...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');
    
    console.log('Migrations completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Only run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });
}

export { migrate };

