import { migrate } from './migrations/migrate.js';

// Run migrations before starting server
migrate()
  .then(() => {
    console.log('Migrations completed, starting server...');
    // Import and start server after migrations
    import('./index.js');
  })
  .catch((error) => {
    console.error('Migration error:', error);
    console.log('Starting server anyway (migrations may have already run)...');
    // Start server even if migrations fail (they might have already run)
    import('./index.js');
  });

