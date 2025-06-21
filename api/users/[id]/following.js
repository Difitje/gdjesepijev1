// api/users/[id]/following.js
const connectToDatabase = require('../../../config'); // Prilagodite putanju
const withAuth = require('../../../auth'); // Prilagodite putanju
const { ObjectId } = require('mongodb');
const cors = require('cors');

const allowCors = cors({ methods: ['GET'], origin: '*' });

module.exports = withAuth(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    if (req.method === 'GET') {
      const { id } = req.query; // ID korisnika čije praćenja želimo dohvatiti

      let db;
      try {
        ({ db } = await connectToDatabase());
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({ _id: new ObjectId(id) });

        if (!user) {
          return res.status(404).json({ message: 'Korisnik nije pronađen.' });
        }

        // Vratite niz ID-jeva korisnika koje ovaj korisnik prati
        // Osigurajte da je following polje uvijek niz, čak i ako nedostaje
        const following = Array.isArray(user.following) ? user.following : [];
        res.status(200).json(following);

      } catch (error) {
        console.error('Greška pri dohvaćanju praćenja:', error);
        res.status(500).json({ message: 'Greška servera pri dohvaćanju praćenja.', error: error.message });
      }
    } else {
      res.status(405).json({ message: 'Metoda nije dozvoljena.' });
    }
  });
});