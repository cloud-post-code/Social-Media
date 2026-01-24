import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import brandRoutes from './routes/brandRoutes.js';
import brandAssetRoutes from './routes/brandAssetRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { migrate } from './migrations/migrate.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
// CORS configuration - explicitly allow all origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // 24 hours
}));

// Explicitly handle OPTIONS requests for all routes
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes - brandAssetRoutes must come before brandRoutes for proper route matching
app.use('/api/brands', brandAssetRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/assets', assetRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Run migrations and start server
async function startServer() {
  // Start server FIRST, then run migrations in background
  // This ensures Railway can see the service is running
  try {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Server accessible on 0.0.0.0:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS enabled: All origins allowed`);
      
      // Run migrations after server starts (non-blocking)
      console.log('Starting database migrations in background...');
      migrate().catch((error: any) => {
        console.error('Migration error (non-fatal):', error);
        console.log('Server continues running despite migration error');
      });
    });
    
    // Handle server errors
    server.on('error', (error: any) => {
      console.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      }
      process.exit(1);
    });
  } catch (error: any) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});
