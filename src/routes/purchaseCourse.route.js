import express from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
  getCoursePurchaseStatus,
  getPurchasedCourses,
  handleStripeWebhook,
  initiateStripeCheckout,
} from '../controllers/coursePurchase.controller.js';

const router = express.Router();

router.route('/checkout/create-checkout-session').post(verifyJWT, initiateStripeCheckout);
router.route('/payments/webhook').post(express.raw({ type: 'application/json' }), verifyJWT, handleStripeWebhook);
router.route('/course/:courseId/detail-with-status').get(verifyJWT, getCoursePurchaseStatus);

router.route('/purchased-courses').get(verifyJWT, getPurchasedCourses);

export default router;
