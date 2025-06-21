// api/users.js
const connectToDatabase = require('./config');
const withAuth = require('./auth');
const { ObjectId } = require('mongodb'); // Možda i ne treba ako samo dohvaćate
const cors = require('cors');

const allowCors = cors({ methods: ['GET'], origin: '*' }); // Samo GET metoda dozvoljena

module.exports = withAuth(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    if (req.method === 'GET') {
      try {
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

        if (!res.status) { console.error("res.status missing in users GET!"); return res.end(JSON.stringify({ message: 'Greška servera pri dohvaćanju korisnika.' })); }
        res.status(200).json(usersToSend);
      } catch (error) {
        console.error('Greška pri dohvaćanju korisnika (api/users):', error);
        if (!res.status) { console.error("res.status missing in users GET error!"); return res.end(JSON.stringify({ message: 'res.status missing: Greška servera pri dohvaćanju korisnika.', error: error.message })); }
        res.status(500).json({ message: 'Greška servera pri dohvaćanju korisnika.', error: error.message });
      }
    } else { // Za sve ostale metode (POST/PUT/DELETE)
      if (!res.status) { console.error("res.status missing in users POST/PUT/DELETE!"); return res.end(JSON.stringify({ message: 'Metoda nije dozvoljena.' })); }
      res.status(405).json({ message: 'Metoda nije dozvoljena.' });
    }
  });
});