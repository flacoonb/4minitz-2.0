#!/usr/bin/env node
const { MongoClient } = require('mongodb');

async function waitConnect(client, maxRetries = 12, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.connect();
      return;
    } catch (err) {
      console.error(`Connect attempt ${i + 1} failed: ${err.message}`);
      if (i === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  const adminUri = process.env.MONGODB_ADMIN_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const targetDb = process.env.TARGET_DB || '4minitz';
  const newUser = process.env.NEW_DB_USER || 'minitz_app';
  const newPass = process.env.NEW_DB_PASS || 'changeMe123!';

  const client = new MongoClient(adminUri);
  try {
    console.log('Trying to connect to MongoDB (admin):', adminUri);
    await waitConnect(client, 15, 2000);

    console.log('Connected to MongoDB');
    const target = client.db(targetDb);

    // Create user in target DB with readWrite and dbAdmin roles
    const cmd = {
      createUser: newUser,
      pwd: newPass,
      roles: [
        { role: 'readWrite', db: targetDb },
        { role: 'dbAdmin', db: targetDb }
      ]
    };

    const res = await target.command(cmd);
    console.log('createUser result:', res);
  } catch (err) {
    console.error('Error creating user:', err);
    process.exitCode = 1;
  } finally {
    try { await client.close(); } catch (_e) {}
  }
}

main();
