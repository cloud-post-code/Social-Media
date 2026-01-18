import { Router } from 'express';
import * as brandController from '../controllers/brandController.js';

const router = Router();

router.get('/', brandController.getAllBrands);
router.get('/:id', brandController.getBrandById);
router.post('/', brandController.createBrand);
router.post('/extract', brandController.extractBrandDNA);
router.put('/:id', brandController.updateBrand);
router.delete('/:id', brandController.deleteBrand);

export default router;

