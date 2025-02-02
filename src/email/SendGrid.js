import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import sgMail from '@sendgrid/mail';
import STATUS_CODES from '../utils/StatusCode.js';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async (options) => {
  const email = options.email;
  const subject = options.subject;
  const message = options.message;
  const link = options.html;

  const msg = {
    to: email,
    from: process.env.SENDER_EMAIL, // Ensure this email is verified in SendGrid
    subject: subject,
    text: message,
    html: link,
  };

  try {
    // Attempt to send the email
    const response = await sgMail.send(msg);
    const extractedResponse = {
      status: STATUS_CODES.ACCEPTED,
      date: response[0]?.headers?.date || new Date().toUTCString(),
      message: 'Email sent successfully',
    };
    console.log(extractedResponse);
    return {
      status: STATUS_CODES.ACCEPTED, // HTTP status code for "Accepted"
      date: response[0]?.headers?.date || new Date().toUTCString(),
      message: 'Email sent successfully',
    };
  } catch (error) {
    console.error('Error sending email:', error.message);

    // Log specific SendGrid error details if available
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }

    // Return an error response
    const extractedError = {
      status: STATUS_CODES.INTERNAL_SERVER_ERROR,
      error: error.message,
      message: 'Failed to send email. Please try again later',
    };
    console.log(extractedError);
    return {
      status: STATUS_CODES.INTERNAL_SERVER_ERROR, // HTTP status code for "Internal Server Error"
      message: 'Failed to send email. Please try again later.',
      error: error.message,
    };
  }
};
