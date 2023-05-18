const express = require('express')
const bodyParser = require('body-parser')
const app = express()
//const db = require('./queries')
const port = 3000
var path = require('path');
const cookieParser = require("cookie-parser");
const pg = require('pg');

const pgPool = new pg.Pool({
  // Insert pool options here
  user: 'thoughtflowadmin',
  host: 'localhost',
  database: 'thoughtflow',
  password: 'p@ssword',
  port: 5432
});
/*
const Pool = require('pg').Pool
const pool = new Pool({
  user: 'thoughtflowadmin',
  host: 'localhost',
  database: 'thoughtflow',
  password: 'p@ssword',
  port: 5432,
})
*/



const logger = require('morgan');
const passport = require('passport');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

//var SQLiteStore = require('connect-sqlite3')(session);


/* ADDED AS IN PASSPORT-FAMILIARISATION*/
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
/* ADDED AS IN PASSPORT-FAMILIARISATION ENDS*/

/*ADDED AS IN PASSPORT-FAMILIARISATION - THIS IS EFFECTIVELY ASSIGNING A PUBLIC DIRECTORY SO THAT THE APP KNOWS WHERE TO GET THE CSS*/
app.use(express.static(path.join(__dirname, 'public')));
/* ADDED AS IN PASSPORT-FAMILIARISATION ENDS*/

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)
//ADDED FROM PASSPORT-FAMILIARISATION THIS IS THE REACT-STYLE EJS RENDERING PATH
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
//ADDED FROM PASSPORT-FAMILIARISATION THIS IS THE REACT-STYLE EJS RENDERING PATH ENDS


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
//app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new pgSession ({
    // Insert connect-pg-simple options here
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
/*
*/

/*
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({ db: 'sessions.db', dir: './var/db' })
}));*/

/* ADDED AS IN PASSPORT-FAMILIARISATION*/
app.use('/', indexRouter);
app.use('/', authRouter);
/* ADDED AS IN PASSPORT-FAMILIARISATION ENDS*/





/*
app.get('/', (request, response) => {
    response.json({ info: 'Node.js, Express, and Postgres API' })
  })

  app.get('/users', db.getUsers)
  app.get('/users/:id', db.getUserById)
  app.post('/users', db.createUser)
  app.put('/users/:id', db.updateUser)
  app.delete('/users/:id', db.deleteUser)
*/
  app.listen(port, () => {
    console.log(`App running on port ${port}.`)
  })