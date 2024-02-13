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