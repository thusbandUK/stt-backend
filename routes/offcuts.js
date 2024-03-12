/*
/*resend verification eamil temporarily changed to resendVerificationEmail2 *//*

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
      console.log(remoteFunction);*//*
  
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
  
/*Reset password temporarily changing below to resetPassword2*//*

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
  

  //Changed to signup2 to test drive above
router.use('/signup2', async (req, res, next) => {
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
  next();*//*

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

*/