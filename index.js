const express = require('express')
// const bodyParser = require('body-parser')
const app = express()
const port = 3000
const cors = require('cors');
var path = require('path');
// const cookieParser = require("cookie-parser");
const pg = require('pg');
const dotenv = require('dotenv').config();

/*accesses database login details from .env file via dbConfig.js to establish new client pool*/

var dbAccess = require('./dbConfig');

const Pool = require('pg').Pool
const pgPool = new Pool(dbAccess);
/*
const pgPool = new pg.Pool({
  // Pool options:
  user: 'thoughtflowadmin',
  host: 'localhost',
  database: 'thoughtflow',
  password: 'p@ssword',
  port: 5432
});
*/



// Allow CORS for known origins
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'development'
        ? process.env.DEV_ORIGIN
        : process.env.PROD_ORIGIN,
    credentials: true,
    //httponly: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  }),
);

const logger = require('morgan');
const passport = require('passport');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);


//authorisation and routes logic import
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');


//assign public directory
app.use(express.static(path.join(__dirname, 'public')));

// Similar middlewares are used in lines 67-68
// app.use(bodyParser.json())
// app.use(
//   bodyParser.urlencoded({
//     extended: true,
//   })
// )

// Allow CORS for known origins
/*
  cors({
    origin:
      process.env.NODE_ENV === 'development'
        ? process.env.DEV_ORIGIN
        : process.env.PROD_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  }),
);
*/
// Temporary ejs code enables mock front-end for development purposes
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// NOTE: cookie-parser middleware is no longer needed 
// for express-session module to work as of version 1.5.0+
// app.use(cookieParser('keyboard cat'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new pgSession ({
    // connect-pg-simple options:
    pool : pgPool,
    tableName : "session"
  }),
  secret: 'keyboard cat',
  //httpOnly: false,
  saveUninitialized: true,
  //secret: process.env.FOO_COOKIE_SECRET,
  resave: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
  // Insert express-session options here
}));

//app.use(middlewareExperiment());




console.log('passport initialize should run next?');
app.use(passport.initialize());
console.log('passport session should run next?');
app.use(passport.session());
app.use(passport.authenticate('session'));
// Need to be used within routes...
// app.use(passport.authenticate('local'));


/*I think this bit is for sending messages*/
app.use(function(req, res, next) {
  //console.log('anonymous message function called');
  var msgs = req.session.messages || [];  
  res.locals.messages = msgs;
  res.locals.hasMessages = !! msgs.length;
  req.session.messages = [];
  next();
});
/*message sending experiment ends*/

app.use('/', indexRouter);
app.use('/', authRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.message.includes("Wrong link.")){
    console.log('SUSPICIOUS BEHAVIOUR ALERT! There was a verification attempt with a non-matching token.')
    return res.status(500).json({message: "Wrong link. Try signing in using your existing details or else sign up again."});
  }
  //log error
  console.error(err.stack)
  
  res.status(500).json({message: 'There was a problem with the server - sorry!'});
})


  app.listen(port, () => {
    console.log(`App running on port ${port}.`)
  })