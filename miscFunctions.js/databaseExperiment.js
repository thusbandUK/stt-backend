//var express = require('express');
//var passport = require('passport');
//var LocalStrategy = require('passport-local');
var crypto = require('crypto');
//var router = express.Router();
var dbAccess = require('../dbConfig');

const { mailOptions, transporter, generateEmailToken, verificationEmail, resetEmail, sendEmail } = require('../email');
//var session = require('express-session')
const { dateCompare } = require('./dateCompare');
const Pool = require('pg').Pool
const pool = new Pool(dbAccess);

/*
Currently configured for two modes, passed as strings - "reset" or "verification"

*/
async function databaseExperiment (email, mode) {
    console.log('database experiment called');
    const client = await pool.connect();
    //assigns email to array for sanitised database query
    console.log(email+mode);
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
        //console.log(userResponse);
        console.log(userResponse.rows.length);
    
        if (userResponse.rows.length === 0){
            console.log('userResponse.rows.length if triggered');
            //No user with that email stored in users error handling
            const error = new Error("No user details available - try signing up again");
            return error;
        }
        if ((mode === "verification") && (userResponse.rows[0].active === true)){
            //Email already verified error handling
            const error = new Error("Email verified already. Try signing in.")
            //return res.status(500).json({message: "Email verified already. Try signing in."})
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
        //throw new Error('woops!');

        //extracts id from verification database query
        const  id  = newDetails.rows[0].id;   
        console.log('database experiment has made it down to the email?');
      
        //Sends the email with the link
        const emailResponse = await sendEmail(email, stringToken, id, mode)
        

        /*const databaseValues = ["Tom", 39, date, 97]
        newDetails = await client.query('INSERT INTO details2 (username, price, next_lesson, user_id) VALUES ($1, $2, $3, $4) RETURNING *', databaseValues) ;*/
                
        await client.query("commit");
        return newDetails.rows[0];

    } catch (error){
        await client.query("ROLLBACK");
        return error;

    } finally {
        client.release();

    }

}

module.exports = { databaseExperiment };