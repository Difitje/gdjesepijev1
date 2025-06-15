// api/register.js
const connectToDatabase = require('./config');
const bcrypt = require('bcryptjs');
const cors = require('cors');

module.exports = cors(async (req, res) => {
  if (req.method === 'POST') {
    try {
      const { username, password, slika, instagram, tiktok, opis } = req.body;

      if (!username || !password || !slika) {
        return res.status(400).json({ message: 'Korisničko ime, lozinka i slika su obavezni.' });
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
        slika,
        instagram: instagram || '',
        tiktok: tiktok || '',
        opis: opis || '',
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