import nodemailer from 'nodemailer';

export const sendEmailNodemailer = async (options) => {
  // Create a test account (for testing mode)
  const testAccount = await nodemailer.createTestAccount();

  // Create a transporter
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: testAccount.user, // Test account username
      pass: testAccount.pass, // Test account password
    },
  });

  // Email options
  const mailOptions = {
    from: '"Ritesh(developer-community)" <noreply@yourapp.com>', // Sender address
    to: options.email, // Receiver's email
    subject: options.subject, // Email subject
    text: options.message, // Plain text body
    html: options.html, // HTML body (optional)
  };

  // Send the email
  const info = await transporter.sendMail(mailOptions);

  // Log the email preview URL (useful for testing)
  console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

  return info;
};
