import express from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
  getUserCourseProgress,
  updateLectureProgress,
  markCourseAsCompleted,
  resetCourseProgress,
} from '../controllers/courseProgress.controller.js';

const router = express.Router();

router.route('/:courseId').get(verifyJWT, getUserCourseProgress);
router.route('/:courseId/lectures/:lectureId').patch(verifyJWT, updateLectureProgress);
router.route('/:courseId/complete').patch(verifyJWT, markCourseAsCompleted);
router.route('/:courseId/reset').patch(verifyJWT, resetCourseProgress);

export default router;
