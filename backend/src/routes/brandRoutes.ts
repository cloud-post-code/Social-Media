import { Router } from 'express';
import * as brandController from '../controllers/brandController.js';

const router = Router();

router.get('/', brandController.getAllBrands);
router.get('/:id', brandController.getBrandById);
router.post('/', brandController.createBrand);
router.put('/:id', brandController.updateBrand);
router.delete('/:id', brandController.deleteBrand);
router.post('/extract', brandController.extractBrandDNA);

// Individual extraction step endpoints (must come before /extract to avoid route conflicts)
router.post('/extract/basic-info', brandController.extractBasicInfo);
router.post('/extract/visual-identity', brandController.extractVisualIdentity);
router.post('/extract/brand-voice', brandController.extractBrandVoice);
router.post('/extract/strategic-profile', brandController.extractStrategicProfile);
router.post('/extract/images', brandController.extractBrandImages);

export default router;

