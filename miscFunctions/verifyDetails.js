var crypto = require('crypto');
//var router = express.Router();
var dbAccess = require('../dbConfig');

const { mailOptions, transporter, generateEmailToken, verificationEmail, resetEmail, createEmailOptions } = require('../email');
//var session = require('express-session')
const { dateCompare } = require('./dateCompare');
const Pool = require('pg').Pool
const pool = new Pool(dbAccess);

//accepts id and mode = string: verification or reset, password parameter only required for password reset mode

async function updateDatabase(id, mode, password){
//router.use('/verifyEmail/:id/:token', async function(req,res,next){  
    
  
    //const id = req.userId;
    const client = await pool.connect();
  
    //assigns id to array for use with database queries
    const values = [id]
    
    
    //query to set active status to true in users table
    const activate = 'UPDATE users SET active = true WHERE id = $1 RETURNING *';
    //query to delete verification data from verification table
    const deleteVerification = `DELETE FROM ${mode} WHERE user_id = $1 RETURNING *`;  
    //const deleteVerification = 'DELETE FROM verification WHERE id = $1 RETURNING *';
    const overwritePassword = 'UPDATE users SET hashed_password = $1, salt = $2 WHERE id = $3 RETURNING *';
  
    try {
      //begins a set of nested queries, only once the user has been activated and the verification data deleted will all the changes 
      //be committed
      await client.query('BEGIN');
      
       //database call to delete token details from verification table
       const deletionResponse = await client.query(deleteVerification, values);
        
       //checks that one row of data has been deleted
       if (deletionResponse.rowCount === 1){    
        
        //for both reset and verification routes, sets active to true
        const activationResponse = await client.query(activate, values);
      
        //checks that the user has been activated in users table
        if (activationResponse.rows[0].active === true){
          //for password reset only, if clause handles storage of updated password details
          if (mode === "reset"){
            //generates random salt;
            var salt = crypto.randomBytes(16);  
            //synchronously hashes the token generated above
            const hashedPassword = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256');
            //prepares array for database query
            const passwordValues = [hashedPassword, salt, id];
            //attempts to overwrite password and salt in database
            const passwordResponse = await client.query(overwritePassword, passwordValues);
            //checks the query has succeeded
            if (passwordResponse.rows[0].id === id){
              //commits all database changes
              await client.query("commit");
              return "actions completed";
            }
          }
          //commits all database changes for successful email verification calls
          await client.query("commit");
          return "actions completed";
        }               
       }
         
      const error = new Error("something went wrong");
      return error;
  
    } catch (error){
      console.log(error);
      await client.query('ROLLBACK');
      
      return error;
      
    } finally {
      client.release();
    }
  }

/*
What should matchToken do? It should compare the supplied and stored tokens and return true if they match

What should the verifyEmail and resetPassword routes do? verifyEmail (CURRENTLY GET BUT CHANGES DATABASE SO MAYBE PUT / POST / DELETE) 
should receive the token, ensure that it matches (see 1 above), delete the verification details stored in the database (see 2 above) 
and accurately return either a 200 or an error with details

resetPassword (POST) should receive the token, ensure that it matches, delete the verification details (in a different table), harvest 
and store the new password (and delete the old one) and accurately return either a 200 or an error with details

matchToken is what timingSafeEqual does, so that shouldn't be a function
*/

async function matchToken(id, token){
   console.log('matchToken called');
    //convert params token to buffer
  var buf = Buffer.from(token, 'hex');  
  
  
  //creates new date object with current time and date
  const currentDateTime = new Date();
        
          pool.query('SELECT * FROM verification WHERE id = $1', [ id ], function(error, results) {
      
          if (error) { 
            //console.log(error);
            //return next(error); 
            return error;
          }
          
          //Checks to see if verification data exists for id specified in params
          if (!results.rows[0]) { 
                  
            //If no data in verification table, error message returned
            //return res.status(500).json({message: 'There was a problem verifying your email. Please generate a new link'});
            const error = new Error("There was a problem verifying your email. Please generate a new link");
            return error;
            
          }
          
          //harvests the user_id and the date and time verification details were stored
          const { date_time_stored, user_id } = results.rows[0]
          
          //checks to see if token has expired
          if (!dateCompare(date_time_stored, currentDateTime)){
            //if token is too old, error message is sent - timing for age of token can be set in imported function
            const error = new Error("Token expired, please request a new verification link");
            //return res.status(500).json({message: 'Token expired, please request a new verification link'});
            return error;
          }

          //The code below checks the supplied token in the verification link and checks it against the value stored in the database
      
          crypto.pbkdf2(buf, results.rows[0].salt, 310000, 32, 'sha256', function(err, hashedBuffer) {
            
            if (err) { 
              //return next(err); 
              return err;
            
            }
            if (!crypto.timingSafeEqual(results.rows[0].hashed_string, hashedBuffer)) {
              //Below logs error via error handling middleware. A non-matching token would amount to suspicious activity
              //and is logged as such by the middleware
              const error = new Error("Wrong link. Try signing in using your existing details or else sign up again");
              //return next(error);              
              return error;
            }      
            //adds the userId harvested from the database query to the request
            //req.userId = user_id;
            
            //calls verificationResult which sets the user's active status to true in users and deletes the verification data from
            //verification
            const verificationResult = verifyDetails(user_id, buf);
            verificationResult.then(function(data){
              console.log(data);
              
              if (data === "actions completed"){
                //return res.status(200).json({message: "Verification complete!"})
                console.log('data returned the details');
                return "verification complete!";
              } else {
                console.log(data);
                //return res.status(500).json({message: "something went wrong"});
                const error = new Error("something went wrong");
                return error;
              }
            })
            //next();            
      
          }); // end hashing function
        }); //end pool request       
  }

//accepts id, token and mode = string: verification or reset

async function prepareBuffers(id, token, mode){

  //convert params token to buffer
  var buf = Buffer.from(token, 'hex');  

  console.log(id);
  console.log(mode);
  //const client = pool.connect();
    
  //creates new date object with current time and date
  const currentDateTime = new Date();

  try {
    const storedTimestampUserId = await pool.query(`SELECT * FROM ${mode} WHERE user_id = $1`, [ id ]);
    console.log(storedTimestampUserId);

    //Checks to see if verification data exists for id specified in params
    if (storedTimestampUserId.rowCount === 0){ 
                  
      //If no data in verification table, error message returned
      const error = new Error("There was a problem verifying your email. Please generate a new link");
      return error;      
    }

    //harvests the user_id and the date and time verification details were stored
    const { date_time_stored } = storedTimestampUserId.rows[0]
          
    //checks to see if token has expired
    if (!dateCompare(date_time_stored, currentDateTime)){
      //if token is too old, error message is sent - timing for age of token can be set in imported function
      
      //return res.status(500).json({message: 'Token expired, please request a new verification link'});
      return new Error('Token expired, please request a new verification link')
    }

    return storedTimestampUserId.rows[0];
  } catch (error){
    console.log(error);
    return error;
  }
}
  module.exports = { updateDatabase, matchToken, prepareBuffers };