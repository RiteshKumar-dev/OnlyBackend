import Stripe from 'stripe';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { Course } from '../models/course.model.js';
import { CoursePurchase } from '../models/coursePurchase.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Lecture } from '../models/lecture.model.js';
import STATUS_CODES from '../utils/StatusCode.js';

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);

const initiateStripeCheckout = asyncHandler(async (req, res) => {
  const user = await User.findOne(req.user?._id);

  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'No user found with this email');
  }
  const { courseId } = req.body;

  // Find course and validate
  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Course not found');
  }

  // Create a new course purchase record
  const newPurchase = new CoursePurchase({
    course: courseId,
    user: user._id,
    amount: course.price,
    status: 'pending',
    paymentMethod: 'stripe',
  });

  // Create Stripe checkout session
  const session = await stripeInstance.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'inr',
          product_data: {
            name: course.title,
            images: [],
          },
          unit_amount: course.price * 100, // Amount in paise
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/course-progress/${courseId}`,
    cancel_url: `${process.env.CLIENT_URL}/course-detail/${courseId}`,
    metadata: {
      courseId: courseId,
      userId: String(user._id),
    },
    shipping_address_collection: {
      allowed_countries: ['IN'],
    },
  });

  if (!session.url) {
    throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Failed to create checkout session');
  }

  // Save purchase record with session ID
  newPurchase.paymentId = session.id;
  await newPurchase.save();

  res.status(200).json({
    success: true,
    data: {
      checkoutUrl: session.url,
    },
  });
});

const handleStripeWebhook = asyncHandler(async (req, res) => {
  const user = await User.findOne(req.user?._id);
  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'No user found with this email');
  }
  let event;

  try {
    const payloadString = JSON.stringify(req.body, null, 2);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers['stripe-signature'];
    const header = stripeInstance.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret,
    });

    event = stripeInstance.webhooks.constructEvent(payloadString, header, secret);
    event = stripeInstance.webhooks.constructEvent(event, sig, secret);
    console.log('first', event);
  } catch (error) {
    console.error('Webhook Error:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const purchase = await CoursePurchase.findOne({
      paymentId: session.id,
    }).populate('course');

    if (!purchase) {
      console.error('Purchase record not found');
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    purchase.amount = session.amount_total ? session.amount_total / 100 : purchase.amount;
    purchase.status = 'completed';
    await purchase.save();

    // Make all lectures accessible
    if (purchase.course?.lectures?.length > 0) {
      await Lecture.updateMany({ _id: { $in: purchase.course.lectures } }, { $set: { isPreviewFree: true } });
    }

    // Update user's enrolled courses
    await User.findByIdAndUpdate(purchase.user._id, { $addToSet: { enrolledCourses: purchase.course._id } }, { new: true });

    // Update course's enrolled students
    await Course.findByIdAndUpdate(purchase.course._id, { $addToSet: { enrolledStudents: purchase.user } }, { new: true });
  }

  res.status(200).json({ received: true });
});
const getCoursePurchaseStatus = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const user = await User.findOne(req.user?._id);
  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'No user found with this email');
  }
  // Find course with populated data
  const course = await Course.findById(courseId).populate('owner', 'userName avatar').populate('lectures', 'title video duration');

  if (!course) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'Course not found');
  }

  // Check if user has purchased the course
  const purchased = await CoursePurchase.exists({
    user: user._id,
    course: courseId,
    status: 'completed',
  });

  res.status(200).json({
    success: true,
    data: {
      course,
      isPurchased: Boolean(purchased),
    },
  });
});

const getPurchasedCourses = asyncHandler(async (req, res) => {
  const user = await User.findOne(req.user?._id);
  if (!user) {
    throw new ApiError(STATUS_CODES.NOT_FOUND, 'No user found with this email');
  }
  const purchases = await CoursePurchase.find({
    userId: user._id,
    status: 'completed',
  }).populate({
    path: 'courseId',
    select: 'courseTitle courseThumbnail courseDescription category',
    populate: {
      path: 'owner',
      select: 'userName avatar',
    },
  });

  res.status(200).json({
    success: true,
    data: purchases.map((purchase) => purchase.courseId),
  });
});

export { initiateStripeCheckout, handleStripeWebhook, getCoursePurchaseStatus, getPurchasedCourses };
