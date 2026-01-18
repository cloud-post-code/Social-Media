import { migrate } from './migrations/migrate.js';
import './index.js';

// Run migrations before starting server
migrate()
  .then(() => {
    console.log('Migrations completed successfully');
  })
  .catch((error) => {
    console.error('Migration error:', error);
    // Don't exit - let server start anyway (migrations might have already run)
  });

