import { Lecture } from '../models/lecture.model.js';
import { Course } from '../models/course.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import STATUS_CODES from '../utils/StatusCode.js';

const createLecture = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user?._id);

    const { title, publicId, description, order, duration, courseId } = req.body;

    // Validate required fields
    if ([title, publicId, description, order, duration, courseId].some((field) => !field || field.trim() === '')) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, 'All fields are required');
    }

    // Validate video file
    if (!req.files || !req.files.video || !req.files.video[0]) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Video file is required');
    }

    // Verify course existence
    const course = await Course.findById(courseId);
    if (!course) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, 'Course not found');
    }

    // Upload video to Cloudinary
    const videoLocalPath = req.files.video[0].path;
    const videoRes = await uploadOnCloudinary(videoLocalPath);
    if (!videoRes || !videoRes.secure_url) {
      throw new ApiError(STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to upload video');
    }

    console.log(title, publicId, description, order, duration, courseId, videoLocalPath);

    // Create lecture
    const lecture = await Lecture.create({
      title,
      publicId,
      description,
      duration,
      order,
      video: videoRes.secure_url,
      course: course._id, // Correctly link the course ID
    });

    // Respond with success
    return res.status(STATUS_CODES.CREATED).json(new ApiResponse(STATUS_CODES.CREATED, lecture, 'Lecture registered successfully'));
  } catch (error) {
    res.status(error.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
});

export { createLecture };
