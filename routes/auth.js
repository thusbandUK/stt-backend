var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
var router = express.Router();
var dbAccess = require('../dbConfig');
const { mailOptions, transporter, generateEmailToken, verificationEmail, resetEmail, sendEmail } = require('../email');
//var session = require('express-session')
const { dateCompare } = require('../miscFunctions.js/dateCompare');
const Pool = require('pg').Pool
const pool = new Pool(dbAccess);
const { databaseExperiment } = require('../miscFunctions.js/databaseExperiment');


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

/*** LOGOUT A USER ***//*
app.post('/api/logout', (req, res, next) => {
	res.clearCookie('connect.sid');  // clear the session cookie
	req.logout(function(err) {  // logout of passport
		req.session.destroy(function (err) { // destroy the session
			res.send(); // send to the client
		});
	});
});
*/

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


/*
router.post('/logout', function(req, res, next){
  req.session.destroy(function(e){
      req.logout();
      res.status(200).clearCookie('connect.sid', {
          path: '/login'
      });
      return res.json({'ok': 1})
  });
});
*/
/*
router.post('/logout', (req, res) => {
  req.logout();
  req.session.destroy((err) => {
    res.clearCookie('connect.sid');
    // Don't redirect, just print text
    res.send('Logged out');
  });
});
*/
/*
router.post('/logout', function(req, res, next) {
  //req.session.destroy();  //interesting, this threw an error, seems to need expression-session middleware (even though that's installed?)
  req.logout(function(err) {
    if (err) { return next(err); }
    res.end();
  });
});
*/




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
            //dateCompare
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
    await client.release();
  }
})

router.post('/resendVerificationEmail', async function (req, res, next) {
  //harvests email address from request body
  const email = req.body.email;

  try {

    const response = await databaseExperiment(email, "verification");
    //console.log(response);
    if (!response.ok){
      //console.log(response.message);
      //throw new Error (response);
      return res.status(500).json({message: response.message});
    }
    return res.status(200).json({message: "Email sent."});

  } catch (error) {
    console.log(error);
    return res.status(500).json(error);

  }

})

/*resend verification eamil temporarily changed to resendVerificationEmail2 */

router.post('/resendVerificationEmail2', async function(req, res, next) {
  //harvests email address from request body
  const email = req.body.email;

  const client = await pool.connect();

  //assigns email to array for sanitised database query
  const values = [email];  

  //database query for user with the email address in the request body
  const userSearch = 'SELECT id, active FROM users WHERE email = $1';

  //generates new date object to store with hashed token
  const date = new Date();
  try {
    /*const remoteFunction = await databaseExperiment();
    console.log(remoteFunction);*/

    //generates random 128 character token and 16 character salt
    const { verificationToken, verificationSalt } = generateEmailToken();
    //converts verification to string to be emailed to user to include as params in their verification link
    const stringToken = verificationToken.toString('hex');
    
    await client.query("begin");
    //queries database to find the user with that email address
    const userResponse = await client.query(userSearch, values);
    
    if (!userResponse.rows[0]){
      //No user with that email stored in users error handling
      return res.status(500).json({message: "No user details available - trying signing up again"});
    }
    
    if (userResponse.rows[0].active === true){
      //Email already verified error handling
      return res.status(500).json({message: "Email verified already. Try signing in."})
    }
    //synchronously hashes the token generated above
    const dataToWrite = crypto.pbkdf2Sync(verificationToken, verificationSalt, 310000, 32, 'sha256');    
      
      //checks to see if there is already any data in the verification table for that user
      const verificationEntry = await client.query('SELECT * FROM verification WHERE user_id = $1', [userResponse.rows[0].id]);
      
      if (verificationEntry.rows[0]){
        //Overwrites any existing entries
        await client.query('DELETE FROM verification WHERE user_id = $1', [userResponse.rows[0].id]);
      }
      
      //inserts hashed token, salt etc. into verification table
      const newDetails = await client.query('INSERT INTO verification (hashed_string, date_time_stored, user_id, salt) VALUES ($1, $2, $3, $4) RETURNING *', [dataToWrite, date, userResponse.rows[0].id, verificationSalt]) 
        //throw new Error('woops!');

        //extracts id from verification database query
        const  id  = newDetails.rows[0].id;   
        
        //Sends the email with the link
        const emailResponse = await sendEmail(email, stringToken, id, "verification")
        await client.query("commit");
        return res.status(200).json({message: 'Verification email sent'});
      

  } catch (error){
    console.log(error);
    await client.query("ROLLBACK");
    return res.status(500).json({message: 'There was some kind of error'});

  } finally {
    client.release();
  }  
})

router.post('/resetPassword', async function(req,res,next){
  const email = req.body.email;
  
  try {
    const response = await databaseExperiment(email, "reset");
    if (!response.ok){
      
      return res.status(500).json({message: response.message});
    }
    return res.status(200).json({message: "Email sent."});

  } catch (error){
    console.log(error);
    return res.status(500).json({message: error});
  }
})

/*Reset password temporarily changing below to resetPassword2*/

router.post('/resetPassword2', async function(req,res,next){
  const email = req.body.email;
  const client = await pool.connect();
  //assigns email to array for sanitised database query
  const values = [email];  

  //database query for user with the email address in the request body
  const userSearch = 'SELECT id, active FROM users WHERE email = $1';

  //generates new date object to store with hashed token
  const date = new Date();

  try {
    //generates random 128 character token and 16 character salt
    const { verificationToken, verificationSalt } = generateEmailToken();
    //converts verification to string to be emailed to user to include as params in their verification link
    const stringToken = verificationToken.toString('hex');

    await client.query("begin");

    //queries database to find the user with that email address
    const userResponse = await client.query(userSearch, values);
    
    if (!userResponse.rows[0]){
      //No user with that email stored in users error handling
      return res.status(500).json({message: "No user details available - trying signing up again"});
    }

    //synchronously hashes the token generated above
    const dataToWrite = crypto.pbkdf2Sync(verificationToken, verificationSalt, 310000, 32, 'sha256');    
      
      //checks to see if there is already any data in the verification table for that user
      const resetEntry = await client.query('SELECT * FROM reset WHERE user_id = $1', [userResponse.rows[0].id]);
      
      if (resetEntry.rows[0]){
        //Overwrites any existing entries
        await client.query('DELETE FROM reset WHERE user_id = $1', [userResponse.rows[0].id]);
      }

      //inserts hashed token, salt etc. into verification table
      const newDetails = await client.query('INSERT INTO reset (hashed_string, date_time_stored, user_id, salt) VALUES ($1, $2, $3, $4) RETURNING *', [dataToWrite, date, userResponse.rows[0].id, verificationSalt]) 
        //throw new Error('woops!');

        //extracts id from verification database query
        const  id  = newDetails.rows[0].id;   
        
        //Sends the email with the link
        const emailResponse = await sendEmail(email, stringToken, id, "reset")


    client.query("commit");
    return res.status(200).json({message: "Email sent."})

  } catch (error) {
    console.log(error);
    client.query("ROLLBACK");
    return res.status(500).json({message: "somethign went wrong"})

  } finally {
    client.release();
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

//router.post('/signup', function(req, res, next){
router.use('/signup', async (req, res, next) => {
//const middlewareExperiment = async function (req, res, next) {
  const { username, email } = req.body;
  const client = await pool.connect();
  const detailsQuery = 'SELECT id, active FROM users WHERE email = $1';
  const detailsReferences = [email];
  const date = new Date();
  

  try {
    const { verificationToken, verificationSalt } = generateEmailToken();
    const stringToken = verificationToken.toString('hex');
    await client.query('BEGIN');
    //queries database for id number
    const dbResponse = await client.query(detailsQuery, detailsReferences);

    const activeAndID = dbResponse.rows[0];
    if (activeAndID.active === true){
      return res.status(404).json({message: 'something went wrong, please contact administrator'});
    }
    crypto.pbkdf2(verificationToken, verificationSalt, 310000, 32, 'sha256', function(err, hashedToken){    
      if (err){ 
        //console.log(err);      
        return next(err); 
      }
      client.query('INSERT INTO verification (hashed_string, date_time_stored, user_id, salt) VALUES ($1, $2, $3, $4) RETURNING *', [hashedToken, date, activeAndID.id, verificationSalt], 
        (error, results) => {
        if (error) {
          //error handling
          console.log(error);
          return next(err);
        }
        const { id } = results.rows[0];        
        
        //Sends the email with the link
        const emailResponse = sendEmail(email, stringToken, id, "verification");
        return res.status(200).json({message: 'Verification email sent'});
      })
    })

    //commits database changes, provided there have been no errors
    await client.query('commit');


  } catch (error){
    await client.query('ROLLBACK')

    res.status(404).json({message: 'Something went wrong'})
  } finally {
    client.release()

  }
  /*console.log('middleware triggered');
  if (req){
  const user = req.user;
  console.log(user);
  res.status(200).json(user);}
  next();*/

})

module.exports = router;