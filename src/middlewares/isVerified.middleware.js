import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const isVerified = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user?._id);
  if (!user) {
    return next(new ApiError(404, 'User not found.'));
  }
  // If user is already verified, allow access
  if (user.isVerified) {
    return next();
  }
  // Otherwise, ask user to verify OTP
  return res.status(403).json({
    success: false,
    message: 'Your account is not verified. Please verify OTP.',
  });
});
