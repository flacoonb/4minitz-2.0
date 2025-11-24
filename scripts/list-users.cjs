#!/usr/bin/env node
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz';

async function run(){
  try{
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}, { projection: { username:1, email:1, role:1, isActive:1 } }).toArray();
    console.log(JSON.stringify(users, null, 2));
    await mongoose.disconnect();
  }catch(err){
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
