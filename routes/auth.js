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


//Passport authentication logic


passport.use(new LocalStrategy(function verify(username, password, cb) {
  //console.log(username+password);
    
  
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



router.post('/login', function(req, res, next) {
  
  passport.authenticate('local', {successMessage: true, failureMessage: true}, function(err, user, info) {
   
    if (err) { return next(err) }
    if (!user) { 
     passport.authenticate('allFailed') 
     return res.status(500).json(info)
   
   }
   
   //passport.authenticate.strategy.success();
   req.logIn(user, function(err) {
     if (err) { return next(err); }
     const {id, email, username} = user;
     
     return res.json({id, email, username});
   })
             
  })(req, res, next);
});

//logout

router.post('/logout', (req, res, next) => {
	
	req.logout(function(err) {  // logout of passport
    //req.session = null;
    
		  req.session.destroy(function (err) { // destroy the session
      res.clearCookie('connect.sid');  // clear the session cookie
			res.send(); // send to the client
		});
    //res.send();
	});
});

//verify email logic

router.get('/verifyEmail/:id/:token', async function(req,res,next){

  //harvest id and token from params
  const { id, token } = req.params;
  
  //convert params token to buffer
  var buf = Buffer.from(token, 'hex');  
  
  //creates new date object with current time and date
  const currentDateTime = new Date();
        
          pool.query('SELECT * FROM verification WHERE id = $1', [ id ], function(error, results) {
      
          if (error) { 
            return next(error); 
          }
          //Checks to see if verification data exists for id specified in params
          if (!results.rows[0]) { 
                  
            //If no data in verification table, error message returned
            return res.status(500).json({message: 'There was a problem verifying your email. Please generate a new link'});
            
          }
          //harvests the user_id and the date and time verification details were stored
          const { date_time_stored, user_id } = results.rows[0]
          
          //checks to see if token has expired
          if (!dateCompare(date_time_stored, currentDateTime)){
            //if token is too old, error message is sent - timing for age of token can be set in imported function
            
            return res.status(500).json({message: 'Token expired, please request a new verification link'});
          }

          //The code below checks the supplied token in the verification link and checks it against the value stored in the database
      
          crypto.pbkdf2(buf, results.rows[0].salt, 310000, 32, 'sha256', function(err, hashedBuffer) {
            
            if (err) { 
              return next(err); }
            if (!crypto.timingSafeEqual(results.rows[0].hashed_string, hashedBuffer)) {
              //Below logs error via error handling middleware. A non-matching token would amount to suspicious activity
              //and is logged as such by the middleware
              const error = new Error("Wrong link. Try signing in using your existing details or else sign up again");
              return next(error);              
            }      
            //adds the userId harvested from the database query to the request
            req.userId = user_id;
            //calls next middleware, which handles database changes
            next();            
      
          }); // end hashing function
        }); //end pool request       
})

//middleware follows initial route function directly above. Once the above function has matched the incoming and stored tokens
//this middleware enacts all the database changes and commits them all as one or reverses the changes if any errors occur
router.use('/verifyEmail/:id/:token', async function(req,res,next){  
  console.log('verifyEmail getting called');

  const id = req.userId;
  const client = await pool.connect();

  //assigns id to array for use with database queries
  const values = [id]
  //query to set active status to true in users table
  const activate = 'UPDATE users SET active = true WHERE id = $1 RETURNING *';
  //query to delete verification data from verification table
  const deleteVerification = 'DELETE FROM verification WHERE user_id = $1 RETURNING *';  

  try {
    //begins a set of nested queries, only once the user has been activated and the verification data deleted will all the changes 
    //be committed
    await client.query('BEGIN');
    
    const activationResponse = await client.query(activate, values);
    //checks that the user has been activated in users table
    if (activationResponse.rows[0].active === true){
      //database call to delete token details from verification table
      const deletionResponse = await client.query(deleteVerification, values);
      //checks that one row of data has been deleted
      if (deletionResponse.rowCount === 1){
        //commits all database changes
        await client.query("commit");
        return res.status(200).json({message: "email verified"});
      }
    }
    throw new Error("there was a problem completing the actions");

  } catch (error){
    console.log(error);
    await client.query('ROLLBACK');
    return res.status(500).json({message: "something went wrong"});
    
  } finally {
    client.release();
  }
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


/* Sign up user*/

router.post('/signup', function(req, res, next){
 
  
  const { username, email } = req.body
  //console.log('hello and username is...');
  //console.log(req.body);
  if (!email || !username || !req.body.password){
    return res.status(500).json({message: 'You must enter all fields to sign up'});
  }
  var salt = crypto.randomBytes(16);  
  crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function(err, hashedPassword){    
    if (err){ 
      //console.log(err);      
      return next(err); 
    }
    pool.query('INSERT INTO users (username, email, hashed_password, salt) VALUES ($1, $2, $3, $4) RETURNING *', [username, email, hashedPassword, salt], 
    (error, results) => {
      if (error) {
        //console.log('if error called');

        if (error.constraint === "users_email_key"){
          //console.log('users email key called');
          //return res.status(500).send("A user with that email already exists. Please sign up with a different email address");
          return res.status(500).json({message: "A user with that email already exists. Please sign up with a different email address"});
        }
        //console.log(error.constraint);
        //throw error
        return res.status(500).json({message: "unspecified server error"})
      }
      //const {token, salt} = verifyEmail();
      var user = {
        
        id: this.lastID,
        username: req.body.username,
        email: email,
        //token: token,
        
      };
      console.log(user);
      req.user = user;
      console.log(req.user);
           

      /* SO THIS WAS HOW THE USER WAS AUTOMATICALLY LOGGED IN FROM THE BEFORE TIMES
      req.logIn(user, function(err) {
        if (err) { return next(err); }
        return res.json(user);
      })
      */
      
          /*PREVIOUSLY THIS WAS HOW IT WORKED AND NOW RESTORED,  */
      //res.status(200).json(user);
      console.log('made it to next function');
      next();

  })    
  
  })
})

router.use('/signup', async (req,res,next) => {

  const email = req.user.email;

  try {

    const response = await storeVerificationDetails(email, "verification");
    //console.log(response);
    if (!response.id){
      //console.log(response.message);
      //throw new Error (response);
      return res.status(500).json({message: response.message});
    }
    return res.status(200).json({message: "Email sent."});

  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "There was some kind of server error. You may need to request another verification email."});

  }
})



module.exports = router;