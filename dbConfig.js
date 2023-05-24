/*
module.exports = {
    user: 'thoughtflowadmin',
    host: 'localhost',
    database: 'thoughtflow',
    password: 'p@ssword', 
    port: 5432,
};
*/
module.exports = {
    user: process.env.USER,
    host: process.env.HOST,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: process.env.PORT
}