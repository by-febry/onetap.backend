const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGO_URI; // Make sure this is set in your .env file
const dbName = 'NFC_DB';

async function printAllCollections() {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      const docs = await db.collection(col.name).find().toArray();
      console.log(`\n--- Collection: ${col.name} ---`);
      console.log(JSON.stringify(docs, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

printAllCollections(); 