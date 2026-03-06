const { Pool, types } = require('pg');
const config = require('./config.json')

// Override the default parsing for BIGINT (PostgreSQL type ID 20)
types.setTypeParser(20, val => parseInt(val, 10));

const connection = new Pool({
  host: config.rds_host,
  user: config.rds_user,
  password: config.rds_password,
  port: config.rds_port,
  database: config.rds_db,
  ssl: config.rds_sslmode === 'require' ? { rejectUnauthorized: false } : false
});
connection.connect((err) => err && console.log(err));


// Route 1: GET /tmp
const tmp = async function(req, res) {
  connection.query(`
    SELECT *
    FROM core.person
    LIMIT 10
  `, (err, data) => {
    if (err) {
      console.log(err);
      res.json({});
    } else {
      res.json(data.rows);
    }
  });
}

module.exports = {
  tmp
}
