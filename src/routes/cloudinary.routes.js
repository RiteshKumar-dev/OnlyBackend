import { Router } from 'express';
import {
  uploadFileOnCloudinary,
  deleteFileFromCloudinary,
  deleteVideofromCloudinary,
  uploadMultipleFilesOnCloudinary,
} from '../controllers/cloudinary.controller.js';
import { upload } from '../middlewares/multer.middleware.js';

const router = Router();

// Define routes
router.route('/upload-multiple').post(upload.array('files', 10), uploadMultipleFilesOnCloudinary);
router.route('/upload').post(upload.single('file'), uploadFileOnCloudinary);
router.route('/delete').delete(deleteFileFromCloudinary);
router.route('/delete-video').delete(deleteVideofromCloudinary);

export default router;
