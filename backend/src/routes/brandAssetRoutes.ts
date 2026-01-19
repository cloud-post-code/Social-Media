import { Router } from 'express';
import * as brandAssetController from '../controllers/brandAssetController.js';

const router = Router();

router.get('/:id/assets', brandAssetController.getBrandAssets);
router.get('/:id/assets/logo', brandAssetController.getBrandLogo);
router.post('/:id/assets', brandAssetController.createBrandAsset);
router.post('/:id/assets/convert-urls', brandAssetController.convertExternalUrls);
router.delete('/:id/assets/:assetId', brandAssetController.deleteBrandAsset);

export default router;

