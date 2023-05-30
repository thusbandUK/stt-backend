var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
var router = express.Router();
var dbAccess = require('../dbConfig');

const Pool = require('pg').Pool
const pool = new Pool(dbAccess);

var journalDivider = require('../journals/journalDivider');


router.get('/', function(req, res, next) {
  //THIS WAS HOW MOCK FRONT END HOME PAGE RENDERED
  //if (!req.user) { return res.render('home'); }
  
  console.log(req.user);
  if (!req.user) { return res.send('home page, not logged in'); }
  //console.log(req.user)
  next();
  //THIS WAS HOW MOCK FRONT END LOGGED IN INDEX PAGE RENDERED
  //res.render('index', { user: req.user });
  // , { user: req.user }
  res.status(200).send('index page, logged in');
});

/*Get journal by name */

router.get('/journal-with-name', async function(req, res, next) {
  const client = await pool.connect()

  const userId = req.user.id;
  const journalTitle = req.query.title;
  //console.log(req.query.title);

  const text = 'SELECT id FROM journal_references WHERE user_id = $1 AND journal_title = $2'
  const values = [userId, journalTitle]

   //executes query
   try {

    //makes async query
    const dbResponse = await client.query(text, values);
    //prunes the database metadata the user doesn't need
    const journalId = dbResponse.rows[0];
    //returns journal_reference.id
    return res.status(200).json(journalId);
            
  } catch (err) {
    //returns generic error message
    res.status(404).json({message: 'No journal found by that title'})  
  }  
})

/*Browse existing journal entries get request */

router.get('/browse-journals', async function(req, res, next) {
  //configures client to connect to database
  const client = await pool.connect()

  //harvests userId from session data (via cookies)
  console.log(req.user);
  
  const userId = req.user.id;
  //const userId = 23;
  //configures database query / parameters
  const text = 'SELECT * FROM journal_references WHERE user_id = $1'
  const values = [userId]

  //executes query
  try {

    //makes async query
    const dbResponse = await client.query(text, values);
    //prunes the database metadata the user doesn't need
    const titlesAndImageUrls = dbResponse.rows.map(({id, user_id, ...rest}) => rest)
    //returns success message and array of json objects of the requested data
    return res.status(200).json(titlesAndImageUrls);
            
  } catch (err) {
    //returns generic error message
    res.status(404).json({message: 'No journal entries found'})  
  }  

});

/*Create new journal */

router.post('/create-journal', async function(req, res, next) {
  const client = await pool.connect()
  
  const userId = req.user.id;  
  const title = req.body.title;
  const url = req.body.url;
  

  const text = 'INSERT INTO journal_references(user_id, journal_title, cover_image) VALUES($1, $2, $3) RETURNING *'
  const values = [userId, title, url]

  try {

    const dbResponse = await client.query(text, values);
    const {journal_title, cover_image} = dbResponse.rows[0];
    return res.status(200).json({ message: `Journal saved with title: ${journal_title} and cover image link: ${cover_image}`});
        
  } catch (err) {

    //console.log(`This is the err.stack part: ${err.stack}`)
    if (err.message.includes('unique')){
      return res.status(500).json({message: 'You have already saved a journal with that title. Please choose a new title'});
    } else if (err.message.includes('long')){
      return res.status(500).json({message: 'Entry not saved. Please choose a title of 50 characters or fewer'});
    } else {
      return res.status(500).json({message: 'An unknown error prevented your journal from being saved.'})
    }    
  }  
  
  //client.release()
    
});

/*Save a journal entry */

router.post('/save-journal', async function(req, res, next) {
  //generates client to connect to database
  const client = await pool.connect()
  
  //harvests journal title and id from req.body object
  const { title, journalId } = req.body;
  
  //transforms journal entry into an array of strings each of no more than 1000 characters in length
  const processedEntry = journalDivider.journalDivider(req.body.journalEntry);
  //determines the number of sections in which the entry will be saved
  const numberOfSections = processedEntry.length;
  

  //defines database query for insertion into the journal_sections table
  const journalSectionEntry = 'INSERT INTO journal_sections(journal_reference_id, section_number) VALUES($1, $2) RETURNING *'
  //defines database query for insertion into the journal_content table
  const journalContentEntry = 'INSERT INTO journal_content(journal_section_id, content) VALUES($1, $2) RETURNING *'

  try {
    //initiates a transaction, so that if there is an error at any stage, the whole set of database changes will be rolled back
    await client.query('BEGIN')
   
    //makes entries for each section of the entry into the journal_sections table; harvests the id for each section
    let x;
    let arrayOfSectionResponses = [];
    for (x = 0; x<numberOfSections; x++){
      const journalSectionValues = [journalId, x+1]
      const dbResponse = await client.query(journalSectionEntry, journalSectionValues)
      arrayOfSectionResponses.push(dbResponse.rows[0]);
    }

    //makes entries for each section of the journal entry into the journal_content table, using the journal_section_id values from 
    //code directly above
    let y;
    let arrayOfContentResponses = [];
    for (y = 0; y<numberOfSections; y++){
      const journalContentValues = [arrayOfSectionResponses[y].id, processedEntry[y]]
      const dbResponse = await client.query(journalContentEntry, journalContentValues)
      arrayOfContentResponses.push(dbResponse.rows[0]);
    }
    //Commits all the changes, provided no errors have occurred
    await client.query('COMMIT')

    //harvests data about the result of the database queries, which can be used to check the number of sections in which it was saved
    //(ie of more use to developer than client)
    finalisedNumberOfSections = arrayOfSectionResponses.pop();
    finalisedContent = arrayOfContentResponses.pop();
    
    return res.status(200).json({ message: `Journal saved with ${finalisedNumberOfSections.section_number} sections and ${finalisedContent.id}`});
  } catch (e) {
    await client.query('ROLLBACK')
    return res.status(500).json({message: `There was some kind of error`});
    
  } finally {
    //releases client from pool
    client.release()
  }  

});

module.exports = router;