// api/config.js
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    if (!MONGODB_URI) {
        throw new Error('Please define the MONGODB_URI environment variable.');
    }
    if (!DB_NAME) {
        throw new Error('Please define the DB_NAME environment variable.');
    }

    try {
        const client = await MongoClient.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        const db = client.db(DB_NAME);

        cachedClient = client;
        cachedDb = db;

        return { client, db };
    } catch (error) {
        console.error("Failed to connect to database:", error);
        throw new Error("Failed to connect to database.");
    }
}

module.exports = connectToDatabase;