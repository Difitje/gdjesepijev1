// api/users/[id]/follow.js
const connectToDatabase = require('../../../config'); // Prilagodite putanju
const withAuth = require('../../../auth'); // Prilagodite putanju
const { ObjectId } = require('mongodb');
const cors = require('cors');

const allowCors = cors({ methods: ['PUT', 'DELETE'], origin: '*' });

module.exports = withAuth(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    const { id } = req.query; // ID korisnika kojeg se prati/otprati
    const currentUserId = req.user.userId; // ID trenutno prijavljenog korisnika

    if (!currentUserId) {
      return res.status(401).json({ message: 'Autorizacijski token nedostaje ili je nevažeći.' });
    }

    if (currentUserId === id) {
      return res.status(400).json({ message: 'Ne možete pratiti ili otpratiti samog sebe.' });
    }

    let db;
    try {
      ({ db } = await connectToDatabase());
      const usersCollection = db.collection('users');

      const targetUser = await usersCollection.findOne({ _id: new ObjectId(id) });
      const currentUser = await usersCollection.findOne({ _id: new ObjectId(currentUserId) });

      if (!targetUser) {
        return res.status(404).json({ message: 'Korisnik kojeg pokušavate pratiti/otpratiti nije pronađen.' });
      }
      if (!currentUser) {
        return res.status(404).json({ message: 'Trenutni korisnik nije pronađen.' });
      }

      // Osigurajte da su polja inicijalizirana kao nizovi
      if (!Array.isArray(targetUser.followers)) targetUser.followers = [];
      if (!Array.isArray(targetUser.following)) targetUser.following = []; // Ovo nije striktno potrebno za targetUser, ali dobra praksa
      if (!Array.isArray(currentUser.followers)) currentUser.followers = []; // Ovo nije striktno potrebno za currentUser, ali dobra praksa
      if (!Array.isArray(currentUser.following)) currentUser.following = [];


      if (req.method === 'PUT') { // FOLLOW logic
        if (currentUser.following.includes(id)) {
          return res.status(409).json({ message: 'Već pratite ovog korisnika.' });
        }

        // Dodaj ID ciljanog korisnika u 'following' niz trenutnog korisnika
        await usersCollection.updateOne(
          { _id: new ObjectId(currentUserId) },
          { $addToSet: { following: id } } // $addToSet sprječava duplikate
        );

        // Dodaj ID trenutnog korisnika u 'followers' niz ciljanog korisnika
        await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $addToSet: { followers: currentUserId } }
        );

        res.status(200).json({ message: 'Korisnik je uspješno zapraćen.' });

      } else if (req.method === 'DELETE') { // UNFOLLOW logic
        if (!currentUser.following.includes(id)) {
          return res.status(409).json({ message: 'Ne pratite ovog korisnika.' });
        }

        // Ukloni ID ciljanog korisnika iz 'following' niza trenutnog korisnika
        await usersCollection.updateOne(
          { _id: new ObjectId(currentUserId) },
          { $pull: { following: id } } // $pull uklanja element iz niza
        );

        // Ukloni ID trenutnog korisnika iz 'followers' niza ciljanog korisnika
        await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $pull: { followers: currentUserId } }
        );

        res.status(200).json({ message: 'Korisnik više nije praćen.' });
      } else {
        res.status(405).json({ message: 'Metoda nije dozvoljena.' });
      }

    } catch (error) {
      console.error(`Greška pri obradi zahtjeva za praćenje/otpraćivanje (${req.method}):`, error);
      res.status(500).json({ message: 'Greška servera pri obradi zahtjeva.', error: error.message });
    }
  });
});