--This part creates a table for login detals

-- SUPERCEDED AS NEEDED ACTIVE COLUMN
-- CREATE TABLE users (id SERIAL,username varchar(40),email varchar(50) UNIQUE,hashed_password bytea,salt bytea,PRIMARY KEY (id));

--THIS IS THE NEW VERSION, CODE NOT TESTED
CREATE TABLE users (id SERIAL,username varchar(40),email varchar(50) UNIQUE,hashed_password bytea,salt BYTEA, active boolean DEFAULT false, PRIMARY KEY (id));

--verification details

--This is for a table in which will be stored the hash of a 128-randomly generated set of characters, a reference to the user-id, and
--the time and date when it was stored

CREATE TABLE verification (id SERIAL,hashed_string bytea NOT NULL,date_time_stored TIMESTAMP NOT NULL,user_id INTEGER REFERENCES users(id) NOT NULL, salt BYTEA NOT NULL, PRIMARY KEY (id));

--reset password (replicates verification details, keeps separate to avoid edge case in which user has both forgotten password and failed to verify email)

CREATE TABLE reset (id SERIAL,hashed_string bytea NOT NULL,date_time_stored TIMESTAMP NOT NULL,user_id INTEGER REFERENCES users(id) NOT NULL, salt BYTEA NOT NULL, PRIMARY KEY (id));

--user details

CREATE TABLE details (
  id SERIAL,
  username VARCHAR NOT NULL,
  price INTEGER,
  next_lesson DATE,
  user_id INTEGER REFERENCES users(id),
  PRIMARY KEY (id)
  
  );

  CREATE TABLE details2 (
  id SERIAL,
  username VARCHAR NOT NULL,
  price INTEGER,
  next_lesson DATE,
  user_id INTEGER REFERENCES users(id),
  PRIMARY KEY (id)
  
  );