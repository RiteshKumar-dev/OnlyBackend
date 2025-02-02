import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadOnCloudinary, deleteFromCloudinary, deleteVideoFromCloudinary } from '../utils/cloudinary.js';
import STATUS_CODES from '../utils/StatusCode.js';

export const uploadFileOnCloudinary = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'No file uploaded' });
  }
  const localFilePath = req.file.path;
  const result = await uploadOnCloudinary(localFilePath);

  if (!result) {
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'File upload failed' });
  }

  res.status(STATUS_CODES.OK).json({
    success: true,
    message: 'File uploaded successfully',
    data: result,
  });
});

export const uploadMultipleFilesOnCloudinary = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'No files uploaded' });
  }

  const uploadResults = [];

  for (const file of req.files) {
    const localFilePath = file.path;
    const result = await uploadOnCloudinary(localFilePath);

    if (!result) {
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `File upload failed for ${file.originalname}`,
      });
    }

    uploadResults.push({
      originalName: file.originalname,
      cloudinaryUrl: result.url,
      publicId: result.public_id,
    });
  }

  res.status(STATUS_CODES.OK).json({
    success: true,
    message: 'Files uploaded successfully',
    data: uploadResults,
  });
});

export const deleteFileFromCloudinary = asyncHandler(async (req, res) => {
  const { publicId } = req.body; // Pass publicId in the request body
  if (!publicId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'publicId is required' });
  }

  const result = await deleteFromCloudinary(publicId);

  if (!result || result.result !== 'ok') {
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to delete file' });
  }

  res.status(STATUS_CODES.OK).json({
    success: true,
    message: 'File deleted successfully',
    data: result,
  });
});

export const deleteVideofromCloudinary = asyncHandler(async (req, res) => {
  const { publicId } = req.body; // Pass publicId in the request body
  if (!publicId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'publicId is required' });
  }

  const result = await deleteVideoFromCloudinary(publicId);

  if (!result || result.result !== 'ok') {
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to delete video' });
  }

  res.status(STATUS_CODES.OK).json({
    success: true,
    message: 'Video deleted successfully',
    data: result,
  });
});
