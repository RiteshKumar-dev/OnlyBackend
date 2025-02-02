import { Course } from '../models/course.model.js';
import { Lecture } from '../models/lecture.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { deleteFromCloudinary, uploadOnCloudinary } from '../utils/cloudinary.js';
import STATUS_CODES from '../utils/StatusCode.js';

const createCourse = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id);
  try {
    const { title, subTitle, category, level, description, price } = req.body;

    // Validate required fields
    if ([title, subTitle, category, level, description, price].some((field) => !field || field.trim() === '')) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, 'All fields are required');
    }

    // Validate thumbnail file
    if (!req.files || !req.files.thumbnail || !req.files.thumbnail[0]) {
      throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Thumbnail file is required');
    }

    // Upload thumbnail to Cloudinary
    const thumbnailLocalPath = req.files.thumbnail[0].path;
    const thumbnailRes = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnailRes || !thumbnailRes.secure_url) {
      throw new ApiError(STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to upload Thumbnail');
    }

    // Create course
    const course = await Course.create({
      title,
      subTitle,
      category,
      level,
      description,
      thumbnail: thumbnailRes.secure_url,
      price,
      instructor: user._id,
      owner: user._id, // Assign the owner
    });

    // Add course to instructor's created courses
    await User.findByIdAndUpdate(user._id, {
      $push: { createdCourses: course._id },
    });

    // Respond with success
    return res.status(STATUS_CODES.CREATED).json(new ApiResponse(STATUS_CODES.CREATED, course, 'Course registered successfully'));
  } catch (error) {
    res.status(error.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
});

const searchCourses = asyncHandler(async (req, res) => {
  const { query = '', categories = [], level, priceRange, sortBy = 'newest' } = req.query;

  // Create search query
  const searchCriteria = {
    isPublished: true,
    $or: [{ title: { $regex: query, $options: 'i' } }, { subtitle: { $regex: query, $options: 'i' } }, { description: { $regex: query, $options: 'i' } }],
  };

  // Apply filters
  if (categories.length > 0) {
    searchCriteria.category = { $in: categories };
  }
  if (level) {
    searchCriteria.level = level;
  }
  if (priceRange) {
    const [min, max] = priceRange.split('-');
    searchCriteria.price = { $gte: min || 0, $lte: max || Infinity };
  }

  // Define sorting
  const sortOptions = {};
  switch (sortBy) {
    case 'price-low':
      sortOptions.price = 1;
      break;
    case 'price-high':
      sortOptions.price = -1;
      break;
    case 'oldest':
      sortOptions.createdAt = 1;
      break;
    default:
      sortOptions.createdAt = -1;
  }

  const courses = await Course.find(searchCriteria)
    .populate({
      path: 'instructor',
      select: 'userName avatar',
    })
    .sort(sortOptions);

  res.status(200).json({
    success: true,
    count: courses.length,
    data: courses,
  });
});

const getPublishedCourses = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [courses, total] = await Promise.all([
    Course.find({ isPublished: true })
      .populate({
        path: 'instructor',
        select: 'userName avatar',
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Course.countDocuments({ isPublished: true }),
  ]);

  res.status(200).json({
    success: true,
    data: courses,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

const getMyCreatedCourses = asyncHandler(async (req, res) => {
  try {
    // Fetch the user by their ID
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Fetch the courses created by the user
    const courses = await Course.find({ instructor: user._id }).populate({
      path: 'enrolledStudents',
      select: 'userName avatar',
    });

    // Check if courses are found
    if (courses.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No courses created by this user',
        count: 0,
        data: [],
      });
    }

    // Return the courses
    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

const getAllCourses = asyncHandler(async (req, res) => {
  try {
    const courses = await Course.find()
      .populate({
        path: 'instructor',
        select: 'userName avatar bio',
      })
      .populate({
        path: 'lectures',
        select: 'title video duration isPreview order',
      });
    res.status(STATUS_CODES.OK).json(new ApiResponse(200, { course: courses }, 'All courses fetched successfully.'));
  } catch (error) {
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json(new ApiError(STATUS_CODES.NOT_FOUND, 'All cousres not found'));
  }
});

const updateCourseDetails = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }
  const { courseId } = req.params;
  const { title, subTitle, description, category, level, price } = req.body;
  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Course not found');
  }
  // Verify ownership
  if (course.instructor.toString() !== user._id.toString()) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Not authorized to update this course');
  }
  // Handle thumbnail upload
  let thumbnail;
  if (req.file) {
    if (course.thumbnail) {
      await deleteFromCloudinary(course.thumbnail);
    }
    const result = await uploadOnCloudinary(req.file.path);
    thumbnail = result?.secure_url || req.file.path;
  }
  const updatedCourse = await Course.findByIdAndUpdate(
    courseId,
    {
      title,
      subTitle,
      description,
      category,
      level,
      price,
      ...(thumbnail && { thumbnail }),
    },
    { new: true, runValidators: true },
  );
  res.status(200).json({
    success: true,
    message: 'Course updated successfully',
    data: updatedCourse,
  });
});

const getCourseDetails = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId)
    .populate({
      path: 'instructor',
      select: 'userName avatar bio',
    })
    .populate({
      path: 'lectures',
      select: 'title video duration isPreview order',
    });

  if (!course) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Course not found');
  }

  res.status(200).json({
    success: true,
    data: {
      ...course.toJSON(),
      averageRating: course.averageRating,
    },
  });
});

const addLectureToCourse = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  const { title, description, isPreview } = req.body;
  const { courseId } = req.params;

  // Get course and verify ownership
  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Course not found');
  }

  if (course.instructor.toString() !== user._id.toString()) {
    throw new ApiError(STATUS_CODES.FORBIDDEN, 'Not authorized to update this course');
  }

  // Process video
  const videoLocalPath = req.files?.video?.[0]?.path;
  if (!videoLocalPath) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Video file is required');
  }

  // Upload video to Cloudinary
  const result = await uploadOnCloudinary(videoLocalPath);
  if (!result) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Error uploading video');
  }

  // Create lecture with video details from Cloudinary
  const lecture = await Lecture.create({
    title,
    description,
    isPreview,
    order: course.lectures && course.lectures.length > 0 ? course.lectures.length + 1 : 1,
    video: result?.secure_url || req.file.path,
    publicId: result?.public_id || req.file.path,
    duration: result?.duration || 0, // Cloudinary provides duration for video files
  });

  console.log('Created Lecture ID:', lecture._id);

  // Ensure `lectures` field exists and add the lecture
  if (!course.lectures) {
    course.lectures = [];
  }
  course.lectures.push(lecture.id);
  await course.save();

  res.status(201).json({
    success: true,
    message: 'Lecture added successfully',
    data: lecture,
  });
});

const getCourseLectures = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }
  const course = await Course.findById(req.params.courseId).populate({
    path: 'lectures',
    select: 'title description video duration isPreview order',
    options: { sort: { order: 1 } },
  });

  if (!course) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Lecture not found');
  }

  // Check if user has access to full course content
  const isEnrolled = course.enrolledStudents.includes(user._id);
  const isInstructor = course.instructor.toString() === user._id.toString();

  let lectures = course.lectures;
  if (!isEnrolled && !isInstructor) {
    // Only return preview lectures for non-enrolled users
    lectures = lectures.filter((lecture) => lecture.isPreview);
  }

  res.status(200).json({
    success: true,
    data: {
      lectures,
      isEnrolled,
      isInstructor,
    },
  });
});

export {
  createCourse,
  getCourseLectures,
  updateCourseDetails,
  searchCourses,
  getPublishedCourses,
  getAllCourses,
  getMyCreatedCourses,
  addLectureToCourse,
  getCourseDetails,
};
