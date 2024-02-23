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
*/