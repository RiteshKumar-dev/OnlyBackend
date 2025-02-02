import Razorpay from 'razorpay';
import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { Course } from '../models/course.model.js';
import { CoursePurchase } from '../models/coursePurchase.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Order
const createOrder = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const options = {
      amount: course.price * 100, // Convert price to paise
      currency: 'INR',
      receipt: `receipt_order_${user._id}`,
      notes: {
        user: user._id.toString(),
        course: course._id.toString(),
      },
    };
    const order = await razorpayInstance.orders.create(options);
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// Verify Payment
const verifyPayment = asyncHandler(async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify payment signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body.toString()).digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // Update purchase record
    const purchase = await CoursePurchase.findOne({
      paymentId: razorpay_order_id,
    });
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase record not found' });
    }

    purchase.status = 'completed';
    await purchase.save();

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      courseId: purchase.course,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Error verifying payment', error: error.message });
  }
});

export { createOrder, verifyPayment };
