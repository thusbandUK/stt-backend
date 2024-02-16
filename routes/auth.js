var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
var router = express.Router();
var dbAccess = require('../dbConfig');
//var session = require('express-session')

const Pool = require('pg').Pool
const pool = new Pool(dbAccess);


//Passport authentication logic


passport.use(new LocalStrategy(function verify(username, password, cb) {
  //console.log(username+password);
    
  
    pool.query('SELECT * FROM users WHERE email = $1', [ username ], function(error, results) {
      
    if (error) { return cb(error); }
    if (!results.rows[0]) { 

      return cb(null, false, { message: 'Incorrect username or password.' }); }

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
/*Email verification function */

/*
so what needs to happen is:
in the signing up logic
1) the password needs to be hashed and stored with its salt
2) a 128 string needs to be generated, hashed and stored in the database with its salt and then its string sent in an email
with the id number of the database row where it's stored
3) separate functions - 
a) sendEmail, with plenty o' parameters
b) generateEmailToken generate random 16-byte salt and random 128-byte buffer / string
4) back in sign up you call generateEmailToken, then store the (hashed) information to the database and then send the email



*/


router.get('/verifyEmail', async function(req,res,next){

  var salt = crypto.randomBytes(16);
      console.log('here is salt');
      console.log(salt)
      var token = crypto.randomBytes(128);
      console.log('here is token');
      console.log(token);
      console.log('and now let\'s try token to string');
      console.log(token.toString('hex'));
      console.log('and now let\'s try turning it back into a buffer');

      const chunk = Buffer.from(token, 'hex');
      console.log(chunk);

      

      try {
        /*
        crypto.randomBytes(256, (err, buf) => {
          if (err) throw err;
          token = buf.toString('hex');
          //console.log(token);
          
          res.status(200).json({token: token});
          //console.log(`${buf.length} bytes of random data: ${buf.toString('hex')}`);
        })*/
        //console.log(stringGeneration);
        crypto.pbkdf2(token, salt, 100000, 64, 
         'sha512', (err, derivedKey) => { 
  
           if (err) throw err; 
  
           // Prints derivedKey 
           console.log(derivedKey.toString('hex')); 
           res.status(200).json({derivedKey: derivedKey.toString('hex')});
        }); 

        

      } catch (error){

        res.status(500).json({message: 'internal server error'});
      }
     

   

})

function verifyEmail() {
return 'hello'      ;
     
}



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
           

      /* SO THIS WAS HOW THE USER WAS AUTOMATICALLY LOGGED IN FROM THE BEFORE TIMES
      req.logIn(user, function(err) {
        if (err) { return next(err); }
        return res.json(user);
      })
      */
      
          /*PREVIOUSLY THIS WAS HOW IT WORKED AND NOW RESTORED,  */
      res.status(200).json(user);

  })    
  
  })
})


module.exports = router;