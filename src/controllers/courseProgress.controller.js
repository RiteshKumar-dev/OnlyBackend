import { ApiError } from '../utils/ApiError.js';
import { CourseProgress } from '../models/courseProgress.js';
import STATUS_CODES from '../utils/StatusCode.js';
import { Course } from '../models/course.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/user.model.js';

const getUserCourseProgress = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  // Get course details with lectures
  const courseDetails = await Course.findById(courseId).populate('lectures').select('title thumbnail lectures');

  if (!courseDetails) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Course not found');
  }

  // Get user's progress for the course
  const courseProgress = await CourseProgress.findOne({
    course: courseId,
    user: req.id,
  }).populate('course');

  // If no progress found, return course details with empty progress
  if (!courseProgress) {
    return res.status(200).json({
      success: true,
      data: {
        courseDetails,
        progress: [],
        isCompleted: false,
        completionPercentage: 0,
      },
    });
  }
  // Calculate completion percentage
  const totalLectures = courseDetails.lectures.length;
  const completedLectures = CourseProgress.lectureProgress.filter((lp) => lp.isCompleted).length;
  const completionPercentage = Math.round((completedLectures / totalLectures) * 100);

  res.status(200).json({
    success: true,
    data: {
      courseDetails,
      progress: courseProgress.lectureProgress,
      isCompleted: courseProgress.completed,
      completionPercentage,
    },
  });
});

const updateLectureProgress = asyncHandler(async (req, res) => {
  // Check if the user exists
  const user = await User.findOne(req.user?._id);

  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'No user found with this email');
  }
  const { courseId, lectureId } = req.params;

  // Find or create course progress
  let courseProgress = await CourseProgress.findOne({
    course: courseId,
    user: req.id,
  });

  if (!courseProgress) {
    courseProgress = await CourseProgress.create({
      user: user._id,
      course: courseId,
      isCompleted: false,
      lectureProgress: [],
    });
  }

  // Update lecture progress
  const lectureIndex = courseProgress.lectureProgress.findIndex((lecture) => lecture.lecture === lectureId);

  if (lectureIndex !== -1) {
    courseProgress.lectureProgress[lectureIndex].isCompleted = true;
  } else {
    courseProgress.lectureProgress.push({
      lecture: lectureId,
      isCompleted: true,
    });
  }

  // Check if course is completed
  const course = await Course.findById(courseId);
  const completedLectures = courseProgress.lectureProgress.filter((lp) => lp.isCompleted).length;
  courseProgress.isCompleted = course.lectures.length === completedLectures;

  await courseProgress.save();

  res.status(200).json({
    success: true,
    message: 'Lecture progress updated successfully',
    data: {
      lectureProgress: courseProgress.lectureProgress,
      isCompleted: courseProgress.isCompleted,
    },
  });
});

const markCourseAsCompleted = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  // Check if the user exists
  const user = await User.findOne(req.user?._id);

  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'No user found with this email');
  }

  // Find course progress
  const courseProgress = await CourseProgress.findOne({
    course: courseId,
    user: user._id,
  });

  if (!courseProgress) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Course progress not found');
  }

  // Mark all lectures as isCompleted
  courseProgress.lectureProgress.forEach((progress) => {
    progress.isCompleted = true;
  });
  courseProgress.isCompleted = true;

  await courseProgress.save();

  res.status(200).json({
    success: true,
    message: 'Course marked as completed',
    data: courseProgress,
  });
});

const resetCourseProgress = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  // Check if the user exists
  const user = await User.findOne(req.user?._id);

  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'No user found with this email');
  }
  // Find course progress
  const courseProgress = await CourseProgress.findOne({
    course: courseId,
    user: user._id,
  });

  if (!courseProgress) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Course progress not found');
  }

  // Reset all progress
  courseProgress.lectureProgress.forEach((progress) => {
    progress.isCompleted = false;
  });
  courseProgress.isCompleted = false;

  await courseProgress.save();

  res.status(200).json({
    success: true,
    message: 'Course progress reset successfully',
    data: courseProgress,
  });
});

export { getUserCourseProgress, updateLectureProgress, markCourseAsCompleted, resetCourseProgress };
