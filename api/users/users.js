// api/users.js
const connectToDatabase = require('./config');
const withAuth = require('./auth');
const { ObjectId } = require('mongodb');
const cors = require('cors');

const allowCors = cors({ methods: ['GET', 'POST', 'PUT', 'DELETE'], origin: '*' });

module.exports = withAuth(async (req, res) => { // Primijeni withAuth
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const currentUserId = req.user ? req.user.userId : null; // Dohvati ID trenutnog korisnika ako je prijavljen

    // === NOVO: Posebno rukovanje za /api/users/me/following ===
    if (req.url === '/api/users/me/following' && req.method === 'GET') {
      if (!currentUserId) {
        return res.status(401).json({ message: 'Autorizacija je potrebna za ovu akciju.' });
      }
      try {
        const user = await usersCollection.findOne({ _id: new ObjectId(currentUserId) });
        if (!user) {
          return res.status(404).json({ message: 'Korisnik nije pronađen.' });
        }
        const following = Array.isArray(user.following) ? user.following : [];
        return res.status(200).json(following);
      } catch (error) {
        console.error('Greška pri dohvaćanju mojih praćenja (api/users/me/following):', error);
        return res.status(500).json({ message: 'Greška servera pri dohvaćanju mojih praćenja.', error: error.message });
      }
    }
    // =========================================================

    if (req.method === 'GET') { // Ova metoda je javna prema api/auth.js
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
            // Ne vraćaj followers/following nizove ovdje da ne opterećuješ previše,
            // dohvaćat ćemo ih posebno samo kada je profil otvoren.
        }));

        if (!res.status) { console.error("res.status missing in users GET!"); return res.end(JSON.stringify({ message: 'Greška servera pri dohvaćanju korisnika.' })); }
        res.status(200).json(usersToSend);
      } catch (error) {
        console.error('Greška pri dohvaćanju korisnika (api/users):', error);
        if (!res.status) { console.error("res.status missing in users GET error!"); return res.end(JSON.stringify({ message: 'res.status missing: Greška servera pri dohvaćanju korisnika.', error: error.message })); }
        res.status(500).json({ message: 'Greška servera pri dohvaćanju korisnika.', error: error.message });
      }
    } else { // Za POST/PUT/DELETE (koje bi bile zaštićene s withAuth)
      if (!res.status) { console.error("res.status missing in users POST/PUT/DELETE!"); return res.end(JSON.stringify({ message: 'Metoda nije dozvoljena.' })); }
      res.status(405).json({ message: 'Metoda nije dozvoljena.' });
    }
  });
});