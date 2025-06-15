// api/users.js
const connectToDatabase = require('./config');
const withAuth = require('./auth');
const { ObjectId } = require('mongodb');
const cors = require('cors');

// Inicijaliziraj CORS middleware za ovu funkciju
// GET je javna ruta (auth.js to kontrolira), ali POST/PUT/DELETE bi bile zaštićene
const allowCors = cors({ methods: ['GET', 'POST', 'PUT', 'DELETE'], origin: '*' });

module.exports = withAuth(async (req, res) => { // withAuth je sada aktivan za POST/PUT/DELETE
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    if (req.method === 'GET') { // Ova metoda je javna prema api/auth.js
      try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();

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
        if (!res.status) { console.error("res.status missing in users GET error!"); return res.end(JSON.stringify({ message: 'Greška servera pri dohvaćanju korisnika.', error: error.message })); }
        res.status(500).json({ message: 'Greška servera pri dohvaćanju korisnika.', error: error.message });
      }
    } else { // Za POST/PUT/DELETE (koje bi bile zaštićene s withAuth)
      if (!res.status) { console.error("res.status missing in users POST/PUT/DELETE!"); return res.end(JSON.stringify({ message: 'Metoda nije dozvoljena.' })); }
      res.status(405).json({ message: 'Metoda nije dozvoljena.' });
    }
  });
});