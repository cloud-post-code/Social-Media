import { Router } from 'express';
import * as assetController from '../controllers/assetController.js';

const router = Router();

router.get('/', assetController.getAllAssets);
router.get('/:id', assetController.getAssetById);
router.post('/generate/product', assetController.generateProductAsset);
router.post('/generate/non-product', assetController.generateNonProductAsset);
router.post('/generate/campaign', assetController.generateCampaignAsset);
router.put('/:id/edit', assetController.editAssetImage);
router.delete('/:id', assetController.deleteAsset);

export default router;

