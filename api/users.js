// api/users.js
const connectToDatabase = require('./config');
const withAuth = require('./auth');
// ObjectId nije potreban ako samo dohvaćate sve korisnike, ali neka stoji radi konzistentnosti
const { ObjectId } = require('mongodb');
const cors = require('cors');

const allowCors = cors({ methods: ['GET'], origin: '*' }); // Samo GET metoda za /api/users

module.exports = withAuth(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    if (req.method === 'GET') {
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

        return res.status(200).json(usersToSend);
      } catch (error) {
        console.error('Greška pri dohvaćanju svih korisnika (api/users):', error);
        return res.status(500).json({ message: 'Greška servera pri dohvaćanju korisnika.', error: error.message });
      }
    } else { // Sve ostale metode na /api/users nisu dozvoljene
      return res.status(405).json({ message: 'Metoda nije dozvoljena za /api/users rutu.' });
    }
  });
});