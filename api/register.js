// api/register.js
const connectToDatabase = require('./config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Vjerojatno je bio samo cors
const cors = require('cors');

const allowCors = cors({ methods: ['POST'], origin: '*' });

const JWT_SECRET = process.env.JWT_SECRET; // Nije se koristio u originalnom registeru, ali neka stoji ako je bio

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    if (req.method === 'POST') {
      try {
        const { username, password, slika, instagram, tiktok, opis } = req.body; // Dodao sam slika, instagram, tiktok, opis ako su bili

        if (!username || !password) { // Prilagođeno vašoj logici iz login.js
          return res.status(400).json({ message: 'Korisničko ime i lozinka su obavezni.' });
        }
        if (!slika) { // Provjera za sliku, ako je obavezna
          return res.status(400).json({ message: 'Profilna slika je obavezna.' });
        }


        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        const existingUser = await usersCollection.findOne({ username: username.toLowerCase() });
        if (existingUser) {
          return res.status(409).json({ message: 'Korisničko ime je već zauzeto!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
          username: username.toLowerCase(),
          password: hashedPassword,
          slika: slika, // Dodaj sliku
          instagram: instagram || '', // Dodaj instagram
          tiktok: tiktok || '', // Dodaj tiktok
          opis: opis || '', // Dodaj opis
          lastActive: new Date().toISOString()
        };

        await usersCollection.insertOne(newUser);

        res.status(201).json({ message: 'Korisnik uspješno registriran!' });

      } catch (error) {
        console.error('Greška pri registraciji:', error);
        res.status(500).json({ message: 'Greška servera pri registraciji.', error: error.message });
      }
    } else {
      res.status(405).json({ message: 'Metoda nije dozvoljena.' });
    }
  });
};