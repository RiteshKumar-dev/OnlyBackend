import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
import { createLecture } from '../controllers/lecture.controller.js';

const router = Router();

router.route('/create-lecture').post(verifyJWT, upload.fields([{ name: 'video', maxCount: 1 }]), createLecture);

export default router;
