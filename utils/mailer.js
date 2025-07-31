const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


async function sendOTPEmail(to, otp) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Evenlyo - Email Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin-bottom: 10px;">Evenlyo</h1>
            <h2 style="color: #666; font-weight: normal;">Email Verification</h2>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Thank you for registering with Evenlyo! To complete your registration, please use the verification code below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 32px; font-weight: bold; padding: 20px; border-radius: 10px; letter-spacing: 5px; display: inline-block;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">This code will expire in 10 minutes for security reasons.</p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">If you didn't request this verification code, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message from Evenlyo. Please do not reply to this email.</p>
        </div>
      </div>
    `,
    text: `Your Evenlyo verification code is: ${otp}. This code will expire in 10 minutes.`
  };
  try {
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Error sending OTP email:', err);
    throw err;
  }
}

module.exports = { sendOTPEmail };
