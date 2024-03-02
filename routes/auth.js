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
/*
router.get('/logout', function (req, res) {
  req.logOut();
  res.status(200).clearCookie('connect.sid', {
    path: '/',
    secure: false,
    httpOnly: false,
    domain: 'localhost:5000',
    sameSite: true,
  });
  req.session.destroy(function (err) {
    res.send();
  });
});
*/
/*
router.get('/logout', function (req, res) {
  req.logOut();
  res.status(200).clearCookie('connect.sid', {
    path: '/'
  });
  req.session.destroy(function (err) {
    res.redirect('/');
  });
});

*/

router.get('/logout', (req, res, next) => {

  //console.log(res.cookie());
	
	req.logout(function(err) {  // logout of passport
    //req.session = null;
    
		  req.session.destroy(function (err) { // destroy the session
      res.clearCookie('connect.sid', {path: '/'});  // clear the session cookie
			res.send(); // send to the client
		});
    //res.send();
	});
});

//Current working verifyEmail route (see verifyEmail2 below)

router.get('/verifyEmail/:id/:token', async function(req,res,next){
  //harvest id and token from params
  const { id, token } = req.params;

  //convert params token to buffer
  var buf = Buffer.from(token, 'hex');  
  
  const storedDetails = await prepareBuffers(id, token, "verification");
  console.log(storedDetails);

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
    //adds the userId harvested from the database query to the request
    //req.userId = user_id;
    
    //calls verificationResult which sets the user's active status to true in users and deletes the verification data from
    //verification
    const updateDatabaseResult = updateDatabase(storedDetails.user_id, "verification");
    updateDatabaseResult.then(function(data){
      
      if (data === "actions completed"){
        return res.status(200).json({message: "Verification complete!"})
      } else {
        console.log(data);
        return res.status(500).json({message: "something went wrong"});
      }
    })
    //next();            

  }); // end hashing function

})

/*
supplied in body: id and string token
checks match, deletes token and assoc data from database
returns instruction to enable input of new password, which will then be harvested via different POST path
*/

router.post('/reset-password-request', async function (req, res, next){

  //harvests id and token
  const { id, token, password } = req.body;

  //convert params token to buffer
  var buf = Buffer.from(token, 'hex');  

  //returns details stored with the supplied id
  const storedDetails = await prepareBuffers(id, token, "reset");

  //The code below checks the supplied token in the reset password link and checks it against the value stored in the database
      
  crypto.pbkdf2(buf, storedDetails.salt, 310000, 32, 'sha256', function(err, hashedBuffer) {
            
    if (err) { 
      return next(err); }
    if (!crypto.timingSafeEqual(storedDetails.hashed_string, hashedBuffer)) {
      //Below logs error via error handling middleware. A non-matching token would amount to suspicious activity
      //and is logged as such by the middleware
      const error = new Error("Wrong link. Try resetting your password again");
      return next(error);              
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

//verify email logic, see not working verifyEmail2 above

router.get('/verifyEmail2/:id/:token', async function(req,res,next){
  

  //harvest id and token from params
  const { id, token } = req.params;
  
  //convert params token to buffer
  var buf = Buffer.from(token, 'hex');  
  
  
  //creates new date object with current time and date
  const currentDateTime = new Date();
        
          pool.query('SELECT * FROM verification WHERE id = $1', [ id ], function(error, results) {
      
          if (error) { 
            console.log(error);
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
            //req.userId = user_id;
            
            //calls verificationResult which sets the user's active status to true in users and deletes the verification data from
            //verification
            const verificationResult = verifyDetails(user_id, buf);
            verificationResult.then(function(data){
              
              if (data === "actions completed"){
                return res.status(200).json({message: "Verification complete!"})
              } else {
                console.log(data);
                return res.status(500).json({message: "something went wrong"});
              }
            })
            //next();            
      
          }); // end hashing function
        }); //end pool request       
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
    return res.status(200).json({message: "Email sent.", email: email});

  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "There was some kind of server error. You may need to request another verification email."});

  }
})

/*
Want wants to happen - it should include req.user and then you can access the id
then send delete calls to details2, reset, verification, via user_id
then send a delete call to users via id
then logout
then (possibly via front end) redirect user
it also needs to delete the session from the database as well as clear the cookie

*/

router.get('/redirect', async function (req, res, next){
  return res.status(200).json({message: "Your account has successfully been deleted"});
})

router.post('/delete-account2', async function (req, res, next){
  //const cookie = req.body.cookie;
  console.log(req.session.id);
  return res.status(200).json({message: "route clicked"});

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
              res.clearCookie('connect.sid');  // clear the session cookie
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






module.exports = router;