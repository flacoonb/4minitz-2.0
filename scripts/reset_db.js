#!/usr/bin/env node
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI (or MONGO_URI) environment variable is required.');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    console.log(`Connected to database: ${db.databaseName}`);

    if (!process.argv.includes('--yes') && process.env.FORCE !== '1') {
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((res) => rl.question('Type RESET to confirm dropping the database: ', res));
      rl.close();
      if (answer !== 'RESET') {
        console.log('Aborted. Database not dropped.');
        process.exit(0);
      }
    }

    console.log('Dropping database...');
    await db.dropDatabase();
    console.log('Database dropped.');
  } catch (err) {
    console.error('Error while dropping database:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
