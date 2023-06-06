var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
var router = express.Router();
var dbAccess = require('../dbConfig');

const Pool = require('pg').Pool
const pool = new Pool(dbAccess);


//Passport authentication logic

passport.use(new LocalStrategy(function verify(username, password, cb) {
  
  
    pool.query('SELECT * FROM users WHERE username = $1', [ username ], function(error, results) {
      
    if (error) { return cb(error); }
    if (!results.rows[0]) { 
      
      return cb(null, false, { message: 'Incorrect username or password.' }); }

    crypto.pbkdf2(password, results.rows[0].salt, 310000, 32, 'sha256', function(err, hashedPassword) {
      if (error) { return cb(error); }
      if (!crypto.timingSafeEqual(results.rows[0].hashed_password, hashedPassword)) {
        return cb(null, false, { message: 'Incorrect username or password.' });
      }
      return cb(null, results.rows[0]);
    });
  });
}));

//Serialise user so they stay logged in during session

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    cb(null, { id: user.id, username: user.username });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});
/*
router.get('/login', function(req, res, next) {
  
  res.send('this route to login');
  next();
});

router.post('/login/password', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
  
  ,
  failureMessage: true
}));
*/
router.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

router.get('/signup', function(req, res, next) {
  
  res.send('signup');
});

/* Sign up user*/

router.post('/signup', function(req, res, next){
  const { username, email } = req.body
  if (!email || !username || !req.body.password){
    return res.status(500).send('You must enter all fields to sign up');
  }
  var salt = crypto.randomBytes(16);  
  crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function(err, hashedPassword){    
    if (err){ return next(err); }
    pool.query('INSERT INTO users (username, email, hashed_password, salt) VALUES ($1, $2, $3, $4) RETURNING *', [username, email, hashedPassword, salt], 
    (error, results) => {
      if (error) {
        if (error.constraint === "users_email_key"){
          return res.status(500).send("A user with that email already exists. Please sign up with a different email address");
        }
        
        throw error
      }
      var user = {
        
        id: this.lastID,
        username: req.body.username,
        email: email
      };
      //console.log(user.id)
      /*SO THIS WOULD BE A GOOD THING TO RETURN TO, I DON'T GET HOW THERE COULD BE A REQ.LOGIN BECAUSE LOGIN ISN'T PART OF THE
      REQUEST BODY BUT WHO KNOWS, I'LL COME BACK TO THIS
      req.login(user, function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      })      */
      //res.redirect('/');
      res.json(user);
  })    
  
  })
})


module.exports = router;