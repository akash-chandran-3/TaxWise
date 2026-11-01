// MySQL connection settings, shared by the app (db.js) and the setup script (db/init.js).
require('dotenv').config({ quiet: true });

// Local MySQL: no SSL needed.
// Cloud MySQL (e.g. Aiven): connections must be encrypted. Set DB_SSL=true and put
// the provider's CA certificate in DB_SSL_CA, so mysql2 can check it's talking to
// the real server and not someone in the middle.
function connectionOptions() {
  const options = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };

  if (process.env.DB_SSL === 'true') {
    options.ssl = { rejectUnauthorized: true };
    if (process.env.DB_SSL_CA) {
      // Accept the PEM pasted either on several lines or with literal "\n"s.
      options.ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
    }
  }

  return options;
}

module.exports = { connectionOptions };
