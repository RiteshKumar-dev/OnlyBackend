import { asyncHandler } from '../utils/asyncHandler.js';
import STATUS_CODES from '../utils/StatusCode.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { sendEmail } from '../email/SendGrid.js';
import { sendEmailNodemailer } from '../email/sendEmail.js';

const genrateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(STATUS_CODES.NOT_FOUND, 'User not found');
    }

    const accessToken = await user.genrateAccessToken();
    const refreshToken = await user.genrateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, 'Something went wrong while genrating token.');
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, userName, password } = req.body;

  // Check if any of the required fields are missing or empty
  if ([fullName, email, userName, password].some((field) => !field || field.trim() === '')) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, 'All fields are required');
  }

  // Check if user already exists
  const existUser = await User.findOne({ $or: [{ userName }, { email }] });
  if (existUser) {
    throw new ApiError(STATUS_CODES.CONFLICT, 'User already exists');
  }

  // Process avatar image
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Avatar file is required');
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar) {
    throw new ApiError(STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to upload avatar');
  }

  // Process cover image if available, otherwise set coverImg to an empty string
  const coverImgLocalPath = req.files?.coverImg?.[0]?.path;
  const coverImg = coverImgLocalPath ? await uploadOnCloudinary(coverImgLocalPath) : { url: '' };

  // Create the user in the database
  const userRef = await User.create({
    fullName,
    avatar: avatar.url,
    coverImg: coverImg.url, // Set to an empty string if no cover image is provided
    email,
    password,
    userName: userName.toLowerCase(),
  });

  // Retrieve the created user without sensitive fields
  const createdUser = await User.findById(userRef._id).select('-password -refreshToken');
  if (!createdUser) {
    throw new ApiError(STATUS_CODES.INTERNAL_SERVER_ERROR, 'Something went wrong while creating user');
  }
  // Return success response
  return res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.CREATED, createdUser, 'User registered successfully'));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password, userName } = req.body;

  if (!userName && !email) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Username or email is required');
  }

  const userData = await User.findOne({
    $or: [{ userName }, { email }],
  }).select('+password');
  if (!userData) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'User not found');
  }

  const isPasswordCorrect = await userData.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Invalid password');
  }
  // Check if the user is verified
  if (!userData.isVerified) {
    // Generate OTP and send it
    await userData.generateOTP();
    return res.status(STATUS_CODES.UNAUTHORIZED).json({
      success: false,
      message: 'OTP sent to your email. Please verify before logging in.',
    });
  }
  const { accessToken, refreshToken } = await genrateAccessAndRefreshToken(userData._id);
  const loggedInUser = await User.findById(userData._id).select('-password -refreshToken');
  const option = { httpOnly: true, secure: true };
  return res
    .status(STATUS_CODES.OK)
    .cookie('accessToken', accessToken, option)
    .cookie('refreshToken', refreshToken, option)
    .json(new ApiResponse(STATUS_CODES.OK, { user: loggedInUser, accessToken, refreshToken }, 'Login successful'));
});
const verifyOTP = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return next(new ApiError(400, 'Email and OTP are required.'));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(new ApiError(404, 'User not found.'));
  }

  try {
    await user.verifyOTP(otp); // If OTP is incorrect, an error will be thrown

    // Mark user as verified
    user.isVerified = true;
    user.verifyCode = undefined;
    user.verifyCodeExpiry = undefined;
    await user.save();

    res.status(200).json(new ApiResponse(200, null, 'OTP verified successfully.'));
  } catch (error) {
    return next(new ApiError(400, 'Invalid or expired OTP.'));
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    // { $set: { refreshToken: undefined } }, //bad approach
    { $unset: { refreshToken: 1 } }, //good approach
    { new: true },
  );
  const option = { httpOnly: true, secure: true };
  res
    .status(STATUS_CODES.OK)
    .clearCookie('accessToken', option)
    .clearCookie('refreshToken', option)
    .json(new ApiResponse(200, {}, 'User logged out'));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Unauthorized request');
  }
  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Invalid refresh token');
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Refresh token is expired or used.');
    }

    const option = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, newrefreshToken } = await genrateAccessAndRefreshToken(user._id);
    return res
      .status(STATUS_CODES.OK)
      .cookie('accessToken', accessToken, option)
      .cookie('refreshToken', newrefreshToken, option)
      .json(new ApiResponse(STATUS_CODES.OK, { accessToken, refreshToken: newrefreshToken }, 'Access token refreshed'));
  } catch (error) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, error.message || 'Refresh token is expired or used.');
  }
});

const changeUserPassword = asyncHandler(async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    console.log(oldPassword, newPassword, confirmPassword);
    if (!(newPassword === confirmPassword)) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Password not matched');
    }
    const user = await User.findById(req.user?._id).select('+password');
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    console.log(isPasswordCorrect);
    if (!isPasswordCorrect) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Invalid old password');
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
    res.status(STATUS_CODES.OK).json(new ApiResponse(200, {}, 'Password change successfully.'));
  } catch (error) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Invalid old password');
  }
});

const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user?._id);

  if (!user) {
    return next(new ApiError(STATUS_CODES.NOT_FOUND, 'User not found.'));
  }

  await User.findByIdAndDelete(req.user._id);

  res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, {}, 'User deleted successfully.'));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(STATUS_CODES.OK).json(new ApiResponse(200, req.user, 'Current user fetched successfully.'));
});

const updateAccountDetails = asyncHandler(async (req, res, next) => {
  const { fullName, userName, email, bio } = req.body;

  if (!fullName && !userName && !email && !bio) {
    return next(new ApiError(STATUS_CODES.BAD_REQUEST, 'At least one field is required to update.'));
  }

  const updateData = {};
  if (fullName) updateData.fullName = fullName;
  if (userName) updateData.userName = userName;
  if (email) updateData.email = email;
  if (bio) updateData.bio = bio;

  const user = await User.findByIdAndUpdate(req.user?._id, { $set: updateData }, { new: true }).select('-password');

  if (!user) {
    return next(new ApiError(STATUS_CODES.NOT_FOUND, 'User not found.'));
  }

  res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, user, 'Account details updated successfully.'));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Avatar path not found.');
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(STATUS_CODES.BAD_GATEWAY, 'Error while on uploading avatar.');
  }
  const user = await User.findByIdAndUpdate(req.user?._id, { $set: { avatar: avatar.url } }, { new: true }).select('-password');
  res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, { user }, 'User avatar updated successfully.'));
});
const updateUserCoverImg = asyncHandler(async (req, res) => {
  const coverImgLocalPath = req.file?.path;
  if (!coverImgLocalPath) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'coverImg path not found.');
  }
  const coverImg = await uploadOnCloudinary(coverImgLocalPath);
  if (!coverImg.url) {
    throw new ApiError(STATUS_CODES.BAD_GATEWAY, 'Error while on uploading coverImg.');
  }
  const user = await User.findByIdAndUpdate(req.user?._id, { $set: { coverImg: coverImg.url } }, { new: true }).select('-password');
  res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, { user }, 'User coverImg updated successfully.'));
});

const getUserChannelProfile = asyncHandler(async (req, res, next) => {
  const { userName } = req.params;

  if (!userName?.trim()) {
    return next(new ApiError(STATUS_CODES.NOT_FOUND, 'Username not found.'));
  }

  const channel = await User.aggregate([
    {
      $match: {
        userName: userName.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subscribers',
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'subscriber',
        as: 'subscribedTo',
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: '$subscribers',
        },
        channelsSubscribedToCount: {
          $size: '$subscribedTo',
        },
        isSubscribed: {
          $in: [req.user?._id, '$subscribers.subscriber'],
        },
      },
    },
    {
      $project: {
        fullName: 1,
        userName: 1,
        email: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImg: 1,
      },
    },
  ]);

  if (!channel || channel.length === 0) {
    return next(new ApiError(STATUS_CODES.NO_CONTENT, 'Channel does not exist.'));
  }

  res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, channel[0], 'User channel fetched successfully.'));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'watchHistory',
        foreignField: '_id',
        as: 'watchHistory',
        pipeline: [
          {
            $lookup: {
              from: 'users',
              localField: 'owner',
              foreignField: '_id',
              as: 'owner',
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: '$owner',
              },
            },
          },
        ],
      },
    },
  ]);

  return res.status(200).json(new ApiResponse(200, user[0].watchHistory, 'Watch history fetched successfully'));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Check if the user exists
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'No user found with this email');
  }

  // Generate a reset token
  const resetToken = user.generateResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // Construct the password reset URL
  const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/users/reset-password/${resetToken}`;
  const message = `You requested a password reset. Please click the following link to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;

  // Determine environment
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    /**
     * Production environment: Send the email to the actual user
     */
    try {
      await sendEmail({
        email: process.env.RECIVER_EMAIL, // User's email
        subject: '🔒 Password Reset Request',
        message,
        html: `
          <div style="max-width: 600px; margin: auto; padding: 20px; border-radius: 10px; font-family: Arial, sans-serif; background: #f4f4f4; text-align: center; border: 1px solid #ddd;">
            <h2 style="color: #333;">🔒 Reset Your Password</h2>
            <p style="font-size: 16px; color: #555;">We received a request to reset your password. Click the button below to proceed:</p>
            <a href="${resetUrl}" style="display: inline-block; background: #007bff; color: #fff; padding: 12px 20px; font-size: 16px; text-decoration: none; border-radius: 5px; margin: 15px 0;">
              Reset Password
            </a>
            <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link in your browser:</p>
            <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 8px; color: #007bff; font-size: 14px;">${resetUrl}</p>
            <p style="font-size: 14px; color: #666;">If you did not request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">This is an automated message. Please do not reply.</p>
          </div>
        `,
      });

      res.status(200).json({
        success: true,
        message: 'Password reset instructions sent to your email.',
      });
    } catch (error) {
      console.error('Error sending email:', error.message);
      throw new ApiError(STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to send email.');
    }
  } else {
    /**
     * Development environment: Log the reset URL instead of sending the email
     */
    await sendEmailNodemailer({
      email: user.email,
      subject: 'Password Reset Request',
      message,
    });
    res.status(200).json({
      success: true,
      message: 'Password reset instructions would be sent to email in production',
      resetUrl, // For testing, return the reset URL in the response
    });
  }
});
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  // Get user by reset token
  const user = await User.findOne({
    resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'),
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Invalid or expired reset token');
  }

  // Update password and clear reset token
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successful',
  });
});

export {
  registerUser,
  verifyOTP,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeUserPassword,
  deleteUser,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImg,
  getUserChannelProfile,
  getWatchHistory,
  forgotPassword,
  resetPassword,
};
