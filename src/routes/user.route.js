import { Router } from 'express';
import {
  loginUser,
  logoutUser,
  registerUser,
  refreshAccessToken,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImg,
  getUserChannelProfile,
  getWatchHistory,
  changeUserPassword,
  deleteUser,
  forgotPassword,
  resetPassword,
  verifyOTP,
} from '../controllers/user.controller.js';
import { upload } from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { isVerified } from '../middlewares/isVerified.middleware.js';

const router = Router();

// Authentication Routes
router.route('/register').post(
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'coverImg', maxCount: 1 },
  ]),
  registerUser,
);
router.route('/verify-otp').post(verifyOTP);
router.route('/login').post(loginUser);
router.route('/logout').post(verifyJWT, logoutUser);
router.route('/refresh-token').post(refreshAccessToken);

// User Account Management
router.route('/current-user').get(verifyJWT, isVerified, getCurrentUser);
router.route('/update-account').patch(verifyJWT, updateAccountDetails);
router.route('/avatar').patch(verifyJWT, upload.single('avatar'), updateUserAvatar);
router.route('/coverImg').patch(verifyJWT, upload.single('coverImg'), updateUserCoverImg);
router.route('/c/:userName').get(getUserChannelProfile);
router.route('/watch-history').get(verifyJWT, getWatchHistory);

// Security & Password Management
router.route('/delete-account').post(verifyJWT, deleteUser);
router.route('/change-password').post(verifyJWT, changeUserPassword);
router.route('/forgot-password').post(forgotPassword);
router.route('/reset-password/:token').post(resetPassword);

export default router;
