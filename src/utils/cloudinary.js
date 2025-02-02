import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file to Cloudinary and removes the local file after upload.
 * @param {string} localFilePath - The path to the local file to upload.
 * @returns {Promise<Object|null>} - The Cloudinary response or null on failure.
 */
const uploadOnCloudinary = async (localFilePath) => {
  if (!localFilePath) {
    console.error('Local file path is required for upload.');
    return null;
  }

  try {
    const fileResponse = await cloudinary.uploader.upload(localFilePath, {
      resource_type: 'auto', // Automatically detect the file type (image, video, etc.)
    });

    console.log('File uploaded to Cloudinary:', fileResponse.url);

    // Remove the local file after successful upload
    fs.unlinkSync(localFilePath);

    return fileResponse;
  } catch (error) {
    console.error('Error uploading file to Cloudinary:', error.message);

    // Attempt to delete the local file if upload fails
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return null;
  }
};

/**
 * Deletes a file from Cloudinary.
 * @param {string} publicId - The public ID of the file to delete on Cloudinary.
 * @returns {Promise<Object|null>} - The Cloudinary response or null on failure.
 */
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) {
    console.error('Public ID is required for deletion.');
    return null;
  }

  try {
    const fileResponse = await cloudinary.uploader.destroy(publicId);
    console.log('File deleted from Cloudinary:', fileResponse);
    return fileResponse;
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error.message);
    return null;
  }
};

/**
 * Deletes a video file from Cloudinary.
 * @param {string} publicId - The public ID of the video file to delete on Cloudinary.
 * @returns {Promise<Object|null>} - The Cloudinary response or null on failure.
 */
const deleteVideoFromCloudinary = async (publicId) => {
  if (!publicId) {
    console.error('Public ID is required for video deletion.');
    return null;
  }

  try {
    const fileResponse = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
    });

    console.log('Video file deleted from Cloudinary:', fileResponse);
    return fileResponse;
  } catch (error) {
    console.error('Error deleting video file from Cloudinary:', error.message);
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary, deleteVideoFromCloudinary };
