// api/register.js
const connectToDatabase = require('./config');
const bcrypt = require('bcryptjs');
const cors = require('cors'); // Uvezi cors modul

// Inicijaliziraj CORS middleware za ovu funkciju
// Dozvoljavamo samo POST metodu za registraciju
const allowCors = cors({ methods: ['POST'], origin: '*' });

module.exports = async (req, res) => {
  // Prvo, obradi CORS preflight zahtjeve (OPTIONS metoda)
  // Ovo je važno za preglednike da provjere dozvole prije slanja POST zahtjeva
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end()); // Odgovori na preflight zahtjev
  }

  // Zatim, primijeni CORS na stvarni zahtjev i pokreni logiku
  return allowCors(req, res, async () => {
    if (req.method === 'POST') {
      try {
        const { username, password, slika, instagram, tiktok, opis } = req.body;

        if (!username || !password || !slika) {
          // Osiguraj da res.status postoji prije poziva
          if (!res.status) { console.error("res.status is missing before 400!"); return res.end(JSON.stringify({ message: 'res.status missing: Korisničko ime, lozinka i slika su obavezni.' })); }
          return res.status(400).json({ message: 'Korisničko ime, lozinka i slika su obavezni.' });
        }

        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        const existingUser = await usersCollection.findOne({ username: username.toLowerCase() });
        if (existingUser) {
          if (!res.status) { console.error("res.status is missing before 409!"); return res.end(JSON.stringify({ message: 'res.status missing: Korisničko ime je već zauzeto!' })); }
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

        if (!res.status) { console.error("res.status is missing before 201!"); return res.end(JSON.stringify({ message: 'res.status missing: Korisnik uspješno registriran!' })); }
        res.status(201).json({ message: 'Korisnik uspješno registriran!' });

      } catch (error) {
        console.error('Greška pri registraciji:', error);
        if (!res.status) { console.error("res.status is missing before 500!"); return res.end(JSON.stringify({ message: 'res.status missing: Greška servera pri registraciji.', error: error.message })); }
        res.status(500).json({ message: 'Greška servera pri registraciji.', error: error.message });
      }
    } else {
      if (!res.status) { console.error("res.status is missing before 405!"); return res.end(JSON.stringify({ message: 'res.status missing: Metoda nije dozvoljena.' })); }
      res.status(405).json({ message: 'Metoda nije dozvoljena.' });
    }
  });
};