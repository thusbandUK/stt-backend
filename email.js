const nodeMailer = require('nodemailer');
const dotenv = require('dotenv').config();
let transporter = nodeMailer.createTransport({
  host: 'smtp.zoho.eu',
  secure: true,
  port: 465,
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false,
  },
});

const mailOptions = {
    from: process.env.EMAIL_ADDRESS, // sender address
    to: 'tadatao@gmail.com',
    subject: 'Hello it\'s a test message!', // Subject line
    html: '<p>test</p>', // plain text body
   };

   module.exports = { mailOptions, transporter };