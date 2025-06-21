// api/users/[id]/followers.js
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
      const { id } = req.query; // ID korisnika čije pratitelje želimo dohvatiti

      let db;
      try {
        ({ db } = await connectToDatabase());
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({ _id: new ObjectId(id) });

        if (!user) {
          return res.status(404).json({ message: 'Korisnik nije pronađen.' });
        }

        // Vratite niz ID-jeva pratitelja
        // Osigurajte da je followers polje uvijek niz, čak i ako nedostaje
        const followers = Array.isArray(user.followers) ? user.followers : [];
        res.status(200).json(followers);

      } catch (error) {
        console.error('Greška pri dohvaćanju pratitelja:', error);
        res.status(500).json({ message: 'Greška servera pri dohvaćanju pratitelja.', error: error.message });
      }
    } else {
      res.status(405).json({ message: 'Metoda nije dozvoljena.' });
    }
  });
});