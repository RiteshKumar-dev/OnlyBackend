import { asyncHandler } from '../utils/asyncHandler.js';
import STATUS_CODES from '../utils/StatusCode.js';
import { ApiError } from '../utils/ApiError.js';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.header('Authorization') && req.header('Authorization').startsWith('Bearer ') ? req.header('Authorization').replace('Bearer ', '') : null);

    if (!token || typeof token !== 'string') {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Unauthorized request: Token missing or invalid');
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken._id).select('-password -refreshToken');
    if (!user) {
      throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Unauthorized request: Invalid token');
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(STATUS_CODES.UNAUTHORIZED, error.message || 'Unauthorized request: Invalid token');
  }
});
