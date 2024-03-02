var crypto = require('crypto');
//var router = express.Router();
var dbAccess = require('../dbConfig');

//var session = require('express-session')
const Pool = require('pg').Pool
const pool = new Pool(dbAccess);

async function deleteAllRecords(userId, sessionId){

    const client = await pool.connect();

    try {
        await client.query("begin");

        const sessionResponse = await client.query('DELETE FROM session WHERE sid = $1', [sessionId]);

        if (sessionResponse.rowCount > 0){
            const usersResponse = await client.query('DELETE FROM users WHERE id = $1', [userId]);
            if (usersResponse.rowCount > 0){
                await client.query("commit");
                return true;
            }
        }        
        throw new Error("Something went wrong");
    } catch (error){
        console.log(error);
        await client.query("ROLLBACK");
        return false;
    } finally {
        client.release();
    }
}

module.exports = { deleteAllRecords };