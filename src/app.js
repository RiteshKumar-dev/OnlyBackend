import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

const app = express();

// Rate limiting
const limiter = rateLimit({
  max: process.env.RATE_LIMIT_MAX,
  windowMs: process.env.RATE_LIMIT_WINDOW * 60 * 1000, // 15 minutes
  message: 'Too many requests from this IP, please try again in an hour',
});

// Security middleware
app.use(helmet());
app.use(mongoSanitize());
app.use(hpp());
app.use('/api', limiter);

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'device-remember-token', 'Access-Control-Allow-Origin', 'origin', 'Accept'],
  }),
);

// Stripe Webhook - Must be before express.json()
app.use('/api/v1/purchase/payments/webhook', express.raw({ type: 'application/json' }));

// Common middleware and body parser (placed after webhook middleware)
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Routes import
import userRouter from './routes/user.route.js';
import razorpayRouter from './routes/razorpay.route.js';
import courseRouter from './routes/course.route.js';
import lectureRouter from './routes/lecture.route.js';
import cloudinaryRouter from './routes/cloudinary.routes.js';
import courseProgressRouter from './routes/courseProgress.route.js';
import purchaseRouter from './routes/purchaseCourse.route.js';

// Routes declaration with security middleware
app.use('/api/v1/users', userRouter);
app.use('/api/v1/razorpay', razorpayRouter);
app.use('/api/v1/courses', courseRouter);
app.use('/api/v1/lectures', lectureRouter);
app.use('/api/v1/cloudinary', cloudinaryRouter);
app.use('/api/v1/progress', courseProgressRouter);
app.use('/api/v1/purchase', purchaseRouter);

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server !!`,
  });
});

export { app };
