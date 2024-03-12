const nodeMailer = require('nodemailer');
const dotenv = require('dotenv').config();
var crypto = require('crypto');

let transporter = nodeMailer.createTransport({
  host: 'smtp.zoho.eu',
  secure: true,
  port: 465,
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD,
    //pass: 'kippersforbreakfastAuntElga',
  },
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false,
  },
});

const mailOptions = {
    from: process.env.EMAIL_ADDRESS, // sender address
    to: '',
    subject: 'Email verification link ', // Subject line
    
   };


const generateEmailToken = () => {
  var salt = crypto.randomBytes(16);
  var token = crypto.randomBytes(128);
  return {verificationSalt: salt, verificationToken: token};

}
/*
async function verificationEmail(email, token, verificationId) {
  const url = process.env.DEV_ORIGIN;
  const path = `${url}/verification-landing?id=${verificationId}&token=${token}`; // plain text body
  const mailOptionsVerification = {
    from: process.env.EMAIL_ADDRESS, // sender address
    to: email,
    subject: 'Email verification link ', // Subject line
    html: `<p>Click the <a href=${path}>link</a> to verify your email</p>`, // plain text body
  }
  
  await transporter.sendMail(mailOptionsVerification, function(err, info) {
    if (err) {
   // handle error
      return(err)
    }
    return "email sent"
  })
       
  }

  async function resetEmail(email, token, verificationId) {
    const url = process.env.DEV_ORIGIN;
    const path = `${url}/reset-landing?id=${verificationId}&token=${token}`; // plain text body
    const mailOptionsVerification = {
      from: process.env.EMAIL_ADDRESS, // sender address
      to: email,
      subject: 'Reset password verification link ', // Subject line
      html: `<p>Click the <a href=${path}>link</a> to verify your email</p>`, // plain text body
    }
    
    await transporter.sendMail(mailOptionsVerification, function(err, info) {
      if (err) {
     // handle error
        return(err)
      }
      return "email sent"
    })
         
    }
*/

    //assigns message and subject line details for pathTypes "verification" and "reset"

    const messageDetails = (pathType) => {
            
      switch(pathType){
        case "reset":
          return {subject: "Reset password verification link", messageFragment: "reset your password"};
          break;
        case "verification":
          return {subject : 'Email verification link', messageFragment: "verify your email"};
          break;
        default: return {subject: "Message from Science Tutor Tom", messageFragment: "say hello"};
      }      
    }

    //takes pathType "reset" or "verification"
    //deleted async from below
    function createEmailOptions(email, token, verificationId, pathType) {
      
      const url = process.env.DEV_ORIGIN;
      const path = `${url}/login/${pathType}-landing?id=${verificationId}&token=${token}`; // plain text body
      const details = messageDetails(pathType);
      const mailOptionsVerification = {
        from: process.env.EMAIL_ADDRESS, // sender address
        to: email,
        subject: details.subject, // Subject line
        html: `<p>Click the <a href=${path}>link</a> to ${details.messageFragment}</p>`, // plain text body
      }
      
      return mailOptionsVerification;      
           
      }

   //module.exports = { mailOptions, transporter, generateEmailToken, verificationEmail, resetEmail, sendEmail };
   module.exports = { mailOptions, transporter, generateEmailToken, createEmailOptions };