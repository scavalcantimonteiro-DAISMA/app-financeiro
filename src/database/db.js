const { createClient } = require('@libsql/client');
const path = require('node:path');
const config = require('../config');

let client = null;

function getDatabase() {
  if (!client) {
    if (config.TURSO_DATABASE_URL && config.TURSO_AUTH_TOKEN) {
      console.log('☁️ Conectado ao Banco de Dados Turso Cloud (Permanente)');
      client = createClient({
        url: config.TURSO_DATABASE_URL,
        authToken: config.TURSO_AUTH_TOKEN
      });
    } else {
      console.log('📁 Conectado ao Banco SQLite Local:', config.DB_PATH);
      client = createClient({
        url: 'file:' + config.DB_PATH
      });
    }
  }
  return client;
}

async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
  }
}

module.exports = {
  getDatabase,
  closeDatabase
};
