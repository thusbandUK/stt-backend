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
  if (!req.user) { return res.render('home'); }
  console.log(req.user)
  next();
  res.render('index', { user: req.user });
});

/*Get journal by name */

router.get('/journal-with-name', async function(req, res, next) {
  const client = await pool.connect()

  const userId = req.user.id;
  const journalTitle = req.body.title;

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
  //const userId = 25;
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

/*Post journal entry */

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
  const client = await pool.connect()
  
  const userId = req.user.id;  
  const title = req.body.title;
  const processedEntry = journalDivider.journalDivider(req.body.journalEntry);
  const numberOfSections = processedEntry.length;
  let sectionNumber = 1;

  const text = 'INSERT INTO journal_sections(journal_reference_id, section_number) VALUES($1, $2) RETURNING *'
  const values = [journalId, sectionNumber+1]

  //const url = req.body.url;
  //const numberOfPages = journalDivider.journalDivider(entry).length;
  //const functionText = journalDivider.journalDivider.toString();
  //const firstArray = journalDivider.journalDivider(entry[0]);


  //const text = 'INSERT INTO journal_references(user_id, journal_title, cover_image) VALUES($1, $2, $3) RETURNING *'
  //const values = [userId, title, url]

  try {
    const res = await client.query(text, values)
    console.log(res.rows[0])
    // { name: 'brianc', email: 'brian.m.carlson@gmail.com' }
  } catch (err) {
    console.log(err.stack)
  }

  //client.query
  //res.locals.messages = [`title entered: ${title}, journal entry: ${entry}, number of pages: ${numberOfPages}`];

  res.locals.messages = [`title entered: ${title}, url: ${url}`];
  res.locals.hasMessages = true;
  //console.log(res.locals)
  //res.redirect('/');
  return res.status(200).json({ message: 'details saved' });
  //.redirect('/')
  //.redirect('/').json({ message: 'details saved' });
  
  //return res.render('index', { user: req.user });
  client.release()
  next();
  //cb({ message: 'Incorrect username or password.' });
  /*db.run('DELETE FROM todos WHERE owner_id = ? AND completed = ?', [
    req.user.id,
    1
  ], function(err) {
    if (err) { return next(err); }
    return { message: 'let\'s see how this goes'};
  });*/
});

module.exports = router;