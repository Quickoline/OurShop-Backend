const nodemailer = require("nodemailer");

const buildTransportConfig = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !user || !pass) {
    throw new Error("SMTP configuration is missing.");
  }

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  };
};

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const transporter = nodemailer.createTransport(buildTransportConfig());

  const subject = "Reset your password";
  const text = `You requested a password reset.\n\nReset link: ${resetUrl}\n\nThis link expires in 10 minutes.`;
  const html = `
    <p>You requested a password reset.</p>
    <p><a href="${resetUrl}">Click here to reset your password</a></p>
    <p>This link expires in 10 minutes.</p>
  `;

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
};

module.exports = {
  sendPasswordResetEmail,
};
