var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
const client = require("../db")
var router = express.Router();


const Pool = require('pg').Pool
const pool = new Pool({
  user: 'thoughtflowadmin',
  host: 'localhost',
  database: 'thoughtflow',
  password: 'p@ssword',
  port: 5432,
})

//var db = require('../queries');

//imported from queries
/*
const getUserById = (request, response) => {
  const id = parseInt(request.params.id)

  pool.query('SELECT * FROM users WHERE id = $1', [id], (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}
*/
//imported from queries ENDS

/*
passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ username: username }, function (err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      if (!user.verifyPassword(password)) { return done(null, false); }
      return done(null, user);
    });
  }
));
*/
//Current section that's been imported from passport-familiarisation

passport.use(new LocalStrategy(function verify(username, password, cb) {
  //db.getUserById(request, response)
  //{ message: 'local strategy gave me a message '}

  //db.get('SELECT * FROM users WHERE username = ?', [ username ], function(err, row) {
    pool.query('SELECT * FROM users WHERE username = $1', [ username ], function(error, results) {
      console.log(results)
    if (error) { return cb(error); }
    if (!results.rows[0]) { return cb(null, false, { message: 'Incorrect username or password.' }); }

    crypto.pbkdf2(password, results.rows[0].salt, 310000, 32, 'sha256', function(err, hashedPassword) {
      if (error) { return cb(error); }
      if (!crypto.timingSafeEqual(results.rows[0].hashed_password, hashedPassword)) {
        return cb(null, false, { message: 'Incorrect username or password.' });
      }
      return cb(null, results.rows[0]);
    });
  });
}));

//Current section that's been imported from passport-familiarisation

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



router.get('/login', function(req, res, next) {
  res.render('login');
});

router.post('/login/password', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

router.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

router.get('/signup', function(req, res, next) {
  res.render('signup');
});

/* the non-passport create user*/
/**/
router.post('/signup', function(req, res, next){
  const { username } = req.body
  var salt = crypto.randomBytes(16);  
  crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function(err, hashedPassword){    
    if (err){ return next(err); }
    pool.query('INSERT INTO users (username, hashed_password, salt) VALUES ($1, $2, $3) RETURNING *', [username, hashedPassword, salt], 
    (error, results) => {
      if (error) {
        throw error
      }
      var user = {
        id: this.lastID,
        username: req.body.username
      };
      /*SO THIS WOULD BE A GOOD THING TO RETURN TO, I DON'T GET HOW THERE COULD BE A REQ.LOGIN BECAUSE LOGIN ISN'T PART OF THE
      REQUEST BODY BUT WHO KNOWS, I'LL COME BACK TO THIS
      req.login(user, function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      })*/      
      res.redirect('/');
  })    
  })
})

/*non passport create-user ends*/
/*
router.post('/signup', function(req, res, next) {
  var salt = crypto.randomBytes(16);  
  crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function(err, hashedPassword) {
    if (err) { return next(err); }
    pool.query('INSERT INTO users (username, hashed_password, salt) VALUES ($1, $2, $3)', [
      req.body.username,
      hashedPassword,
      salt
    ], function(err) {
      if (err) { return next(err); }
      var user = {
        id: this.lastID,
        username: req.body.username
      };
      req.login(user, function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });
    });
  });
});
*/
module.exports = router;