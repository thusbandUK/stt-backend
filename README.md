# how to set up and install app

The first stage is to create and configure a PostgreSQL database. If PostgreSQL is not already installed, visit the following link and
install as per your operating system. (Note: these instructions relate to Windows configuration)

https://www.postgresql.org/download/

Follow on screen instructions. Note: default password for postgres installation is 'postgres'. Make a note of the password for the following steps.

To launch Postgres (windows instructions), from the command line, navigate to the bin folder of the PostgreSQL program files:

```
"Program Files/PostgreSQL\15\bin"
```
Next login to postgres with the following command:

    psql.exe --username postgres 

The default user role postgres will be a superuser, so create a new role with which to login in with restricted privileges.
~~~
CREATE ROLE thoughtflowadmin WITH LOGIN PASSWORD 'p@ssword';
~~~
Next grant thoughtflowadmin the ability to create databases:
~~~
ALTER ROLE thoughtflowadmin CREATEDB;
~~~
Next quit postgres in order to log back in as thoughtflowadmin

~~~ 
\q 
~~~

Now log back into postgres as thoughtflowadmin:(NOTE: NO SEMI-COLON SHOULD FOLLOW COMMAND)
~~~
psql -d postgres -U thoughtflowadmin
~~~
Use following code to create database:
~~~
CREATE DATABASE thoughtflow;
~~~
Connect to the thoughtflow database:
~~~
\c thoughtflow
~~~
Create database using the following command to create database:
~~~
CREATE TABLE users (id SERIAL,username varchar(40),email varchar(50) UNIQUE,hashed_password bytea,salt bytea,PRIMARY KEY (id));
CREATE TABLE journal_references (id SERIAL,user_id int REFERENCES users(id),journal_title varchar(50),cover_image varchar(60),UNIQUE (user_id, journal_title),PRIMARY KEY (id));
CREATE TABLE journal_sections (id SERIAL,journal_reference_id int REFERENCES journal_references(id),section_number int,UNIQUE (journal_reference_id, section_number),PRIMARY KEY (id));
CREATE TABLE journal_content (id SERIAL,journal_section_id int REFERENCES journal_sections(id) UNIQUE,content varchar(1000),PRIMARY KEY (id));
~~~
Now run the following code to run an additional table in which session data will be stored:
~~~
CREATE TABLE "session" ("sid" varchar NOT NULL COLLATE "default","sess" json NOT NULL,"expire" timestamp(6) NOT NULL)WITH (OIDS=FALSE);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
~~~
Now run the following code to grant the necessary privileges for the thoughtflowadmin role:
~~~
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO thoughtflowadmin;
~~~
Now that the postgresql database is configured, you are ready to run the app. Download or clone the github code, eg: in git bash
~~~
git clone https://github.com/chingu-voyages/v44-tier3-team-42be.git
~~~
Next switch to the v44-tier3-team-42be folder
~~~
cd v44-tier3-team-42be
~~~
Next install the necessary packages:
~~~
npm install
~~~
Finally run the app with the following command:
~~~
node index.js
~~~

# using backend with a GUI, eg: Postman

Having launched the app, the routes can be tested with a GUI. Postman is a good interface for this and the instructions below will
assume that is the GUI in use. 

**Signup**

url / route: localhost:[PORT]/signup
body: (use json format) {"username": "[INSERT USERNAME]", "password": "[INSERT PASSWORD]", "email": "[INSERT EMAIL"]}

Note that having signed up, the app is configured to redirect the user to the login page, where they will then need to sign in, as follows:

**signin**

url / route: localhost:[PORT]/login/password
body: {"username": "[INSERT USERNAME]", "password": "[INSERT PASSWORD]"}

Note: the response will contain a cookie, which you should copy for use later.

# Routes that require the user to be logged in

The backend is configured to initiate a session so that having logged in, the user remains logged in. This is achieved by the creation 
of a session cookie, mentioned in the **signin** section above.

To test routes that require the user to be logged in, configure authorisation in your GUI. If using Postman, in the **Authorization** tab select **Api Key**. Make sure **Key** is set to **Cookie** then paste the cookie saved in the **signin** section above and paste it into the **Value** section, prepending it with: 
~~~
connect.sid=
~~~
So if the cookie text is: "I-am-a-cookie", you would paste into the **value** section:
~~~
connect.sid=I-am-a-cookie
~~~

Now when you test the routes that require the user to be logged in, the request object will have a key **user.id** containing the database ID returned when the user first signed in.


# voyage-tasks

Your project's `readme` is as important to success as your code. For 
this reason you should put as much care into its creation and maintenance
as you would any other component of the application.

If you are unsure of what should go into the `readme` let this article,
written by an experienced Chingu, be your starting point - 
[Keys to a well written README](https://tinyurl.com/yk3wubft).

And before we go there's "one more thing"! Once you decide what to include
in your `readme` feel free to replace the text we've provided here.

> Own it & Make it your Own!
