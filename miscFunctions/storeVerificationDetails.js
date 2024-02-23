//var express = require('express');
//var passport = require('passport');
//var LocalStrategy = require('passport-local');
var crypto = require('crypto');
//var router = express.Router();
var dbAccess = require('../dbConfig');

const { mailOptions, transporter, generateEmailToken, verificationEmail, resetEmail, createEmailOptions } = require('../email');
//var session = require('express-session')
const { dateCompare } = require('./dateCompare');
const Pool = require('pg').Pool
const pool = new Pool(dbAccess);

/*
Currently configured for two modes, passed as strings - "reset" or "verification"

*/
async function storeVerificationDetails (email, mode) {
    
    const client = await pool.connect();
    //assigns email to array for sanitised database query
    const values = [email];  

    //database query for user with the email address in the request body
    const userSearch = 'SELECT * FROM users WHERE email = $1';

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
            
        if (userResponse.rows.length === 0){
            const error = new Error("No user details available - try signing up again");
            return error;
        }
        if ((mode === "verification") && (userResponse.rows[0].active === true)){
            const error = new Error("Email verified already. Try signing in.")
            console.log(error);
            return error;
          }

        //synchronously hashes the token generated above
        const dataToWrite = crypto.pbkdf2Sync(verificationToken, verificationSalt, 310000, 32, 'sha256');    
      
        //checks to see if there is already any data in the verification OR reset table for that user
        const existingEntry = await client.query(`SELECT * FROM ${mode} WHERE user_id = $1`, [userResponse.rows[0].id]);
    
        if (existingEntry.rows[0]){
        //Overwrites any existing entries
        await client.query(`DELETE FROM ${mode} WHERE user_id = $1`, [userResponse.rows[0].id]);
        }

        //inserts hashed token, salt etc. into verification table
        const newDetails = await client.query(`INSERT INTO ${mode} (hashed_string, date_time_stored, user_id, salt) VALUES ($1, $2, $3, $4) RETURNING *`, [dataToWrite, date, userResponse.rows[0].id, verificationSalt]) 
        
        //extracts id from verification database query
        const  id  = newDetails.rows[0].id;   
              
        //Creates the mailOptions object to send email via transporter tomorrow
        const emailOptions = createEmailOptions(email, stringToken, id, mode)
        
        //sends email via transporter object in email.js
        const emailOk = await transporter.sendMail(emailOptions);
                
        //commits database changes                
        await client.query("commit");
        return newDetails.rows[0];

    } catch (error){
        console.log('catch caught error')
        console.log(error);
        if (error.responseCode === 535){
            return new Error("There was a problem sending the email. Please try again");
        }
        await client.query("ROLLBACK");
        return error;

    } finally {
        client.release();

    }

}

module.exports = { storeVerificationDetails };