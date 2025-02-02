import { Router } from 'express';
import {
  createCourse,
  getCourseLectures,
  updateCourseDetails,
  searchCourses,
  getMyCreatedCourses,
  getPublishedCourses,
  getCourseDetails,
  addLectureToCourse,
  getAllCourses,
} from '../controllers/course.controller.js';
import { upload } from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.route('/create-course').post(verifyJWT, upload.fields([{ name: 'thumbnail', maxCount: 1 }]), createCourse);
router.route('/all-course').get(verifyJWT, getAllCourses);
router.route('/search').get(verifyJWT, searchCourses);
router.route('/published').get(verifyJWT, getPublishedCourses);
router.route('/my-course').get(verifyJWT, getMyCreatedCourses);
router.route('/:courseId').patch(verifyJWT, updateCourseDetails);
router.route('/:courseId').get(verifyJWT, getCourseDetails);
router.route('/:courseId/lectures').post(verifyJWT, upload.fields([{ name: 'video', maxCount: 1 }]), addLectureToCourse);
router.route('/:courseId/lectures').get(verifyJWT, getCourseLectures);

export default router;
