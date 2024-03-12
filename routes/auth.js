var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
var router = express.Router();
var dbAccess = require('../dbConfig');
const { mailOptions, transporter, generateEmailToken, verificationEmail, resetEmail, sendEmail } = require('../email');
const { dateCompare } = require('../miscFunctions/dateCompare');
const Pool = require('pg').Pool
const pool = new Pool(dbAccess);
const { storeVerificationDetails } = require('../miscFunctions/storeVerificationDetails');
const { updateDatabase, matchToken, prepareBuffers } = require('../miscFunctions/verifyDetails');
const { deleteAllRecords } = require('../miscFunctions/delete');
const { query, param, body, matchedData, validationResult } = require('express-validator');

/*



The below functions are configured to send error messages in the following format:

{messages: [
  {
    path: [string: username, password, email OR general]
    msg: [string: individual message]
  }
]}

the loginSlice reducer updateErrorConsole then updates the error object in the redux store

This is the format in which error messages are passed by the express-validator dependency at the back end

*/

//validation functions

//password validator requires length 6 to 16, one capital, one lowercase, one number, one special symbol, escapes <, > and '
const newPasswordValidator = () => body('password').matches(/^(?=.*[0-9])(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,16}$/).escape().withMessage("Must contain at least one capital, lower case letter, number and special symbol but not <, > or '")

//existing password validator (same as newPasswordValidator but just returns a simpler message: "Invalid password")
const existingPasswordValidator = () => body('password').matches(/^(?=.*[0-9])(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,16}$/).escape().withMessage("Invalid password");

//email validator
const emailValidator = () => body('email').isEmail().toLowerCase().escape().withMessage("Please enter a valid email address");

//username validator
const newUsernameValidator = () => body('username').matches(/^[a-zA-Z0-9]{5,20}$/).toLowerCase().escape().withMessage("Usernames can only contain letters and numbers, with no spaces, and must be 5 to 20 characters long. Not case sensitive");

//id validator
const idValidator = () => param('id').isNumeric().escape().withMessage("corrupted id");

//token validator
const tokenValidator = () => param('token').isHexadecimal().escape().withMessage("corrupted token");

//Passport authentication logic

/*
Note that the below function is configured to receive an email address as a username. Here "username" is retained
because it is automatically parsed as passed as "username" by the Passport functions in the Node modules
However, in order that other code reads more intuitively, the front end passes the email as "email" in req.body object
Then (see below) in the post.login route, req.body.username is defined from req.body.email, all of which facilitates
middleware that will validate email addresses passed to *any* routes via express-validator
*/
passport.use(new LocalStrategy(function verify(username, password, cb) {
   
    pool.query('SELECT * FROM users WHERE email = $1', [ username ], function(error, results) {
      
    if (error) { return cb(error); }
    if (!results.rows[0]) { 

      return cb(null, false, { message: 'Incorrect username or password.' }); }

    if (results.rows[0].active === false){      
      return cb(null, false, { message: 'You need to verify your email address.' });        
    }
    crypto.pbkdf2(password, results.rows[0].salt, 310000, 32, 'sha256', function(err, hashedPassword) {
      
      if (err) { return cb(err); }
      if (!crypto.timingSafeEqual(results.rows[0].hashed_password, hashedPassword)) {
        
        return cb(null, false, { message: 'Incorrect username or password.' });
      }
      
      return cb(null, results.rows[0]);

    });
  });
}));

//Serialise user so they stay logged in during session

passport.serializeUser(function(user, cb) {
  console.log('did serialise get called first?');
  
  process.nextTick(function() {
    cb(null, { id: user.id, username: user.username });
  });
});

passport.deserializeUser(function(user, cb) {
  
  process.nextTick(function() {
    return cb(null, user);
  });
});



router.post('/login', emailValidator(), existingPasswordValidator(), function(req, res, next) {
  
  //extracts results for any incoming data which failed validation tests
  const result = validationResult(req);
  
  //returns individual messages with advice to overcome any validation failures
  if (!result.isEmpty()){
    return res.status(500).json({messages: result.array()});
  }

  //extract data which passed the validation test
  const data = matchedData(req);   
 
  //creates variables for validated data
  const { email, password } = data;
  
  //this is really important - the Passport logic is configured to receive usernames but the front end is configured
  //to authenticate users with their email address, so here username is created with the *validated* value of the input email
  req.body.username = email;

  //likewise req.body.password is overwritten with the validated password, ahead of the below Passport authentication logic
  req.body.password = password;
  
  
  passport.authenticate('local', {successMessage: true, failureMessage: true}, function(err, user, info) {
   
    if (err) { return next(err) }
    //console.log('user posted below from passport login call')
    //console.log(user);
    if (!user) { 
     passport.authenticate('allFailed') 
     //return res.status(500).json(info)
     //console.log(info);
     return res.status(500).json({messages: [{path: "general", msg: info.message}]});
   
   }
   
   //passport.authenticate.strategy.success();
   req.logIn(user, function(err) {
     if (err) { return next(err); }
     const {id, email, username} = user;
     
     return res.json({id, email, username});
   })
             
  })(req, res, next);
});

//logout route

router.get('/logout', (req, res, next) => {

  req.logout(function(err) {  // logout of passport
        
		  req.session.destroy(function (err) { // destroy the session
      res.clearCookie('connect.sid', {path: '/'});  // clear the session cookie
			res.send(); // send to the client
		});
    
	});
});

//Current working verifyEmail route

router.get('/verifyEmail/:id/:token', idValidator(), tokenValidator(), async function(req,res,next){

  //extract any results of validation failures
  const result = validationResult(req);  
  
  if (!result.isEmpty()){
    //logs errors to console, since validation failure may signal malicious intent
    console.log(result.array());    
    //returns error, same message no matter whether id or token fails validation
    return res.status(500).json({messages: [{path: "general", msg: "Corrupted link. Please request new one."}]});
  }
  
  //extract data which passed the validation test
  const data = matchedData(req);   
 
  //creates variables for validated data
  const { id, token } = data;  

  //convert params token to buffer
  var buf = Buffer.from(token, 'hex');
  
  //calls prepareBuffers function to obtain stored buffer to match from database
  const storedDetails = await prepareBuffers(id, token, "verification");
  //passes on error if prepareBuffers returns error
  if (storedDetails instanceof Error){
    return res.status(500).json({messages: [{path: "general", msg: "No record of link details found. Please generate new verification link."}]});
  }

  //The code below checks the supplied token in the verification link and checks it against the value stored in the database
      
  crypto.pbkdf2(buf, storedDetails.salt, 310000, 32, 'sha256', function(err, hashedBuffer) {
            
    if (err) { 
      return next(err); }
    if (!crypto.timingSafeEqual(storedDetails.hashed_string, hashedBuffer)) {
      //Below logs error via error handling middleware. A non-matching token would amount to suspicious activity
      //and is logged as such by the middleware
      const error = new Error("Wrong link. Try signing in using your existing details or else sign up again");
      return next(error);              
    }      
        
    //calls updateDatabase to set user active status to true and delete verification data
    const updateDatabaseResult = updateDatabase(storedDetails.user_id, "verification");
    updateDatabaseResult.then(function(data){
      
      if (data === "actions completed"){
        return res.status(200).json({message: "Verification complete!"})
      } else {
        console.log(data);
        return res.status(500).json({messages: [{general: "something went wrong. You may need to reverify."}]});
      }
    })    

  }); // end hashing function

})

/*
supplied in body: id and string token
checks match, deletes token and assoc data from database
returns instruction to enable input of new password, which will then be harvested via different POST path
*/

router.post('/reset-password-request/:id/:token', idValidator(), tokenValidator(), newPasswordValidator(), async function (req, res, next){
  const result = validationResult(req);
    //console.log(result);
    if (!result.isEmpty()){
      console.log(result);
      //returns corrupted link message if id or token fail validation checks
      if (result.errors[0].path === "id" || result.errors[0].path === "token"){
        return res.status(500).json({messages: [{path: "general", msg: "Corrupted link. Please wait to be redirected to request a new one."}]});
      }      
    }
    const sanitisedData = matchedData(req);
    //const password = sanitisedData.password;

  //harvests id and token
  const { id, token, password } = sanitisedData;

  //convert params token to buffer
  var buf = Buffer.from(token, 'hex');  

  //returns details stored with the supplied id
  const storedDetails = await prepareBuffers(id, token, "reset");
  //passes on error if prepareBuffers returns error
  if (storedDetails instanceof Error){
    return res.status(500).json({messages: [{path: "general", msg: "No record of link details found. Please generate new verification link."}]});
  }

  //returns error if password fails validation
  if (!result.isEmpty()){    
    if (result.errors[0].path === "password"){
      //returns criteria creating secure password
      return res.status(500).json({messages: result.array()});
    }
  }

  //The code below checks the supplied token in the reset password link and checks it against the value stored in the database
      
  crypto.pbkdf2(buf, storedDetails.salt, 310000, 32, 'sha256', function(err, hashedBuffer) {
            
    if (err) { 
      return next(err); }
    if (!crypto.timingSafeEqual(storedDetails.hashed_string, hashedBuffer)) {
      //Below logs error via error handling middleware. A non-matching token would amount to suspicious activity
      //and is logged as such by the middleware
      //const error = new Error("Wrong link. Try resetting your password again");
      //return next(error);
      return res.status(500).json({messages: [{path: "general", msg: "Wrong link. Try signing in using your existing details or else sign up again."}]});
    }      
    //adds the userId harvested from the database query to the request
    //req.userId = user_id;
    
    //calls verificationResult which sets the user's active status to true in users and deletes the verification data from
    //verification
    const updateDatabaseResult = updateDatabase(storedDetails.user_id, "reset", password);
    updateDatabaseResult.then(function(data){
      
      if (data === "actions completed"){
        return res.status(200).json({message: "Password updated"});
      } else {
        console.log(data);
        return res.status(500).json({message: "something went wrong"});
      }
    })
    //next();            

  }); // end hashing function

})




router.post('/resendVerificationEmail', async function (req, res, next) {
  //harvests email address from request body
  const email = req.body.email;

  try {

    const response = await storeVerificationDetails(email, "verification");
    
    if (!response.id){
      
      return res.status(500).json({message: response.message});
    }
    return res.status(200).json({message: "Email sent."});

  } catch (error) {
    console.log(error);
    return res.status(500).json(error);

  }

})

//reset password route

router.post('/resetPassword', async function(req,res,next){
  console.log('reset password route called');
  const email = req.body.email;
  
  try {
    const response = await storeVerificationDetails(email, "reset");
    console.log(response);
    if (!response.id){
      
      return res.status(500).json({message: response.message});
    }
    return res.status(200).json({message: "Email sent."});

  } catch (error){
    console.log(error);
    return res.status(500).json({message: error});
  }
})

//see new signup test route at the bottom

router.post('/signup3', function (req, res, next){
  const {username, password, email} = req.body;
  console.log(username+password+email)
  return res.status(200).json({message: username+password+email})
})

/* Sign up user */

router.post('/signup', newPasswordValidator(), emailValidator(), newUsernameValidator(), function(req, res, next){
  
  //extract any results of validation failures
  const result = validationResult(req);
  
  //returns error(s) specifying reasons for validation failures
  if (!result.isEmpty()){    
    return res.status(500).json({messages: result.array()});
  }
  
  //extract data which passed the validation test
  const data = matchedData(req);   
 
  //creates variables for validated data
  const { username, email, password } = data;
  
  //returns error message if any of the fields is empty (probably unnecessary given validation functions)
  if (!email || !username || !password){
    return res.status(500).json({messages: [{path: 'general', msg: 'You must enter all fields to sign up'}]});
  }

  //creates random salt to hash password
  var salt = crypto.randomBytes(16);  

  //hashes input password
  crypto.pbkdf2(password, salt, 310000, 32, 'sha256', function(err, hashedPassword){    
    if (err){       
      return next(err); 
    }
    //attempts database entry of signup details, including salt and hashed password
    pool.query('INSERT INTO users (username, email, hashed_password, salt) VALUES ($1, $2, $3, $4) RETURNING *', [username, email, hashedPassword, salt], 
    async (error, results) => {
      if (error) {
        
        if (error.constraint === "users_email_key"){
          
          //Informs user there is already an account with that email address
          return res.status(500).json({messages: [{path: "general", msg: "A user with that email already exists. Please sign up with a different email address"}]});
        }
        
        return res.status(500).json({messages: [{path: "general", msg: "unspecified server error"}]})
      }
      
      var user = {
        
        id: this.lastID,
        username: req.body.username,
        email: email,        
      };
      
      req.user = user;
      
      //calls imported function which prepares and sends a verification email
      const response = await storeVerificationDetails(email, "verification");
      
      if (!response.id){      
        return res.status(500).json({messages: [{path: "general", msg: response.message}]});
      }
      //returns success message along with email
      return res.status(200).json({message: "Email sent.", email: email});
  })    
  
  })
})

router.get('/redirect', async function (req, res, next){
  return res.status(200).json({message: "Your account has successfully been deleted"});
})

//temporarily changed to 2 for experiment above

router.post('/delete-account', async function (req, res, next){
  if (!req.user){
    return res.redirect('/redirect');
  }
  const { password } = req.body;
  
  const { id } = req.user;
  console.log(id);
  //return res.status(200).json({message: id});

  const deleteRequest = 'DELETE FROM users WHERE id = $1 RETURNING *';
  
  const queryValues = [ id ];
  const client = await pool.connect();

  pool.query('SELECT * FROM users WHERE id = $1', [ id ], function(error, results) {
      
    if (error) { return cb(error); }
    if (!results.rows[0]) { 

      return res.status(500).json({ message: 'Incorrect username or password.' }); }

    crypto.pbkdf2(password, results.rows[0].salt, 310000, 32, 'sha256', function(err, hashedPassword) {
      
      if (err) { return next(err); }
      if (!crypto.timingSafeEqual(results.rows[0].hashed_password, hashedPassword)) {
        
        return res.status(500).json({ message: 'Incorrect username or password.' });
      }

      const databaseResponse = deleteAllRecords(req.user.id, req.session.id);
      databaseResponse.then((response) => {
        if (response){
          req.logout(function(err) {  // logout of passport
            //req.session = null;
            
              req.session.destroy(function (err) { // destroy the session
              res.clearCookie('connect.sid', {path: '/'});  // clear the session cookie
              res.send(); // send to the client
            });
          //return res.redirect("/account-deleted");
        })
      } else {
        return next(new Error("There was a problem deleting the records"));
      }
    })
      
      //return next();

    }); //crypto query ends
  }); //pool query ends
})


//the below is a test route created to introduce validation logic

//idValidator(), tokenValidator(),

router.get('/verifyEmail2/:id/:token', idValidator(), tokenValidator(),  function(req, res, next) {
  console.log('got to start of testPassword')
  //body('password').matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{8,}$/, "i")
  const result = validationResult(req);
  console.log(result);
  const data = matchedData(req);
  console.log(data);
  if (!result.isEmpty()){
    console.log(result.errors[0].msg);
    return res.status(500).json({message: result.array()});
  }
  //console.log(req.body.password);
  //return (data.username.toLowercase());
  return res.status(200).json({message: data.id+data.token});
  //req.check("password", "Password should be combination of one uppercase , one lower case, one special char, one digit and min 8 , max 20 char long").regex("/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{8,}$/", "i");
  //req.check("password", "...").matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{8,}$/, "i");

})



module.exports = router;