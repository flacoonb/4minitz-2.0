#!/usr/bin/env node
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz';

async function run(){
  try{
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const series = await db.collection('meetingseries').find({}, { projection: { name:1, project:1 } }).toArray();
    console.log(JSON.stringify(series, null, 2));
    await mongoose.disconnect();
  }catch(err){
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
