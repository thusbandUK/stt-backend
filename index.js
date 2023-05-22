const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 3000
var path = require('path');
const cookieParser = require("cookie-parser");
const pg = require('pg');

const pgPool = new pg.Pool({
  // Pool options:
  user: 'thoughtflowadmin',
  host: 'localhost',
  database: 'thoughtflow',
  password: 'p@ssword',
  port: 5432
});


const logger = require('morgan');
const passport = require('passport');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);


//authorisation and routes logic import
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');

//assign public directory
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

// Temporary ejs code enables mock front-end for development purposes
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new pgSession ({
    // connect-pg-simple options:
    pool : pgPool,
    tableName : "session"
  }),
  secret: 'keyboard cat',
  saveUninitialized: true,
  //secret: process.env.FOO_COOKIE_SECRET,
  resave: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
  // Insert express-session options here
}));
app.use(passport.authenticate('session'));

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


  app.listen(port, () => {
    console.log(`App running on port ${port}.`)
  })