// api/users.js
const connectToDatabase = require('./config');
const withAuth = require('./auth'); // Npr. da samo prijavljeni vide sve korisnike
const { ObjectId } = require('mongodb'); // Uvezi ObjectId
const cors = require('cors');

const allowCors = cors({ methods: ['GET'], origin: '*' }); // Samo GET metoda za ovaj endpoint

module.exports = withAuth(async (req, res) => { // Primijeni withAuth
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    if (req.method === 'GET') { // Ova metoda je javna prema api/auth.js
      try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        // Dohvati sve korisnike, ali ne vraćaj lozinke!
        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();

        // Prilagodi format za frontend (id, ime, slika, lastActive...)
        const usersToSend = users.map(user => ({
            id: user._id.toString(),
            ime: user.username,
            slika: user.slika,
            instagram: user.instagram,
            tiktok: user.tiktok,
            opis: user.opis,
            lastActive: user.lastActive
        }));

        res.status(200).json(usersToSend);
      } catch (error) {
        console.error('Greška pri dohvaćanju korisnika (api/users):', error);
        res.status(500).json({ message: 'Greška servera pri dohvaćanju korisnika.', error: error.message });
      }
    } else { // Nedozvoljena metoda
      res.status(405).json({ message: 'Metoda nije dozvoljena.' });
    }
  });
});