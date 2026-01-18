import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import brandRoutes from './routes/brandRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { migrate } from './migrations/migrate.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/brands', brandRoutes);
app.use('/api/assets', assetRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Run migrations and start server
async function startServer() {
  try {
    console.log('Running database migrations...');
    await migrate();
    console.log('Migrations completed, starting server...');
  } catch (error: any) {
    console.error('Migration error:', error);
    console.log('Starting server anyway (migrations may have already run)...');
  }
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
