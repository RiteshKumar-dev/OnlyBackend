import mongoose, { Schema } from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendEmail } from '../email/SendGrid.js';
const userSchema = new Schema(
  {
    userName: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [20, 'Username must be less than 20 characters'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please enter a valid email'],
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      maxlength: [50, 'Full name must be less than 50 characters'],
      trim: true,
    },
    avatar: {
      type: String,
      required: [true, 'Avatar is required'],
      default: 'default-avatar.png',
    },
    coverImg: {
      type: String,
      required: [true, 'Cover image is required'],
      default: 'default-coverImg.png',
    },
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Video',
      },
    ],
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 6 characters'],
      select: false,
    },
    refreshToken: {
      type: String,
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'student', 'instructor', 'admin'],
        message: 'Please select a valid role',
      },
      default: 'user',
    },
    bio: {
      type: String,
      maxLength: [200, 'Bio cannot exceed 200 characters'],
    },
    enrolledCourses: [
      {
        course: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Course',
        },
        enrolledAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpire: {
      type: Date,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    verifyCode: String,
    verifyCodeExpiry: Date,
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};
userSchema.methods.genrateAccessToken = async function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      userName: this.userName,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    },
  );
};
userSchema.methods.genrateRefreshToken = async function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    },
  );
};

userSchema.methods.generateResetPasswordToken = function () {
  // Generate a random reset token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash the reset token and store it in the database
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Set expiration time for the reset token (e.g., 15 minutes)
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  // Return the plain reset token (not the hashed version)
  return resetToken;
};

// Virtual field for total enrolled courses
userSchema.virtual('totalEnrolledCourses').get(function () {
  return this.enrolledCourses?.length;
});

// Update lastActive timestamp
userSchema.methods.updateLastActive = function () {
  this.lastActive = Date.now();
  return this.save({ validateBeforeSave: false });
};

// OTP Generation
userSchema.methods.generateOTP = async function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.verifyCode = crypto.createHash('sha256').update(otp).digest('hex');
  this.verifyCodeExpiry = Date.now() + 5 * 60 * 1000; // OTP valid for 5 minutes
  await this.save();
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const msg = {
      to: process.env.RECIVER_EMAIL,
      from: process.env.SENDER_EMAIL,
      subject: '🔐 Your One-Time Password (OTP)',
      text: `Your OTP code is: ${otp}. It is valid for 5 minutes.`,
      html: `<div style="max-width: 600px; margin: auto; padding: 20px; border-radius: 10px; font-family: Arial, sans-serif; background: #f4f4f4; text-align: center; border: 1px solid #ddd;">
        <h2 style="color: #333;">🔐 Secure Login OTP</h2>
        <p style="font-size: 16px; color: #555;">Use the OTP below to complete your authentication. This code is valid for <strong>5 minutes</strong>.</p>
        <div style="font-size: 24px; font-weight: bold; color: #007bff; padding: 10px; border-radius: 8px; background: #fff; display: inline-block; margin: 15px auto;">
          ${otp}
        </div>
        <p style="font-size: 14px; color: #666;">If you did not request this code, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">This is an automated message. Please do not reply.</p>
      </div>`,
    };
    await sendEmail({
      email: msg.to, // User's email
      subject: msg.subject,
      message: msg.text,
      html: msg.html,
    });
  } else {
    console.log(`Your OTP code is: ${otp}. It is valid for 5 minutes.`);
  }
  return otp;
};

// OTP Verification
userSchema.methods.verifyOTP = async function (otp) {
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  if (hashedOtp !== this.verifyCode || this.verifyCodeExpiry < Date.now()) {
    throw new Error('Invalid or expired OTP');
  }
  this.isVerified = true;
  this.verifyCode = undefined;
  this.verifyCodeExpiry = undefined;
  await this.save();
};

export const User = mongoose.model('User', userSchema);
