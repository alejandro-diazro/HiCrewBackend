const nodemailer = require('nodemailer');

// Create a transporter (reusable across all emails)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendEmail = async ({ to, subject, text, html }) => {
    try {
        const info = await transporter.sendMail({
            from: `"${process.env.EMAIL_NAME}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        });
        console.log(`Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send email');
    }
};

const sendRegistrationRequestEmail = async ({ email, firstName, lastName }) => {
    const subject = 'HiCrew Registration Request Received';
    const text = `Dear ${firstName} ${lastName},\n\nYour registration request has been received and is pending review. We'll notify you once it's approved.\n\nThank you,\nHiCrew Team`;
    const html = `<p>Dear ${firstName} ${lastName},</p><p>Your registration request has been received and is pending review. We'll notify you once it's approved.</p><p>Thank you,<br>HiCrew Team</p>`;

    await sendEmail({ to: email, subject, text, html });
};

const sendWelcomeEmail = async ({ email, firstName, lastName }) => {
    const subject = 'Welcome to HiCrew!';
    const text = `Dear ${firstName} ${lastName},\n\nWelcome to HiCrew! Your account has been successfully created. You can now log in and start exploring.\n\nThank you,\nHiCrew Team`;
    const html = `<p>Dear ${firstName} ${lastName},</p><p>Welcome to HiCrew! Your account has been successfully created. You can now log in and start exploring.</p><p>Thank you,<br>HiCrew Team</p>`;

    await sendEmail({ to: email, subject, text, html });
};

const sendPasswordResetEmail = async ({ email, firstName, lastName, resetToken }) => {
    const subject = 'HiCrew Password Reset Request';
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const text = `Dear ${firstName} ${lastName},\n\nYou have requested to reset your password. Please click the following link to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.\n\nThank you,\nHiCrew Team`;
    const html = `<p>Dear ${firstName} ${lastName},</p><p>You have requested to reset your password. Please click the following link to reset your password:</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link will expire in 1 hour.</p><p>If you did not request this, please ignore this email.</p><p>Thank you,<br>HiCrew Team</p>`;

    await sendEmail({ to: email, subject, text, html });
};

module.exports = {
    sendRegistrationRequestEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
};