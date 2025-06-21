// api/follow.js
const connectToDatabase = require('../config'); // Prilagodite putanju ako je potrebno
const withAuth = require('../auth'); // Prilagodite putanju ako je potrebno
const { ObjectId } = require('mongodb');

module.exports = withAuth(async (req, res) => {
  const { db } = await connectToDatabase();
  const followsCollection = db.collection('follows'); // Nova kolekcija za praćenje
  const userId = req.user.userId; // Trenutno prijavljen korisnik

  if (req.method === 'POST') {
    // Zapratite korisnika
    try {
      const { targetUserId } = req.body;

      if (!targetUserId || targetUserId === userId) {
        return res.status(400).json({ message: 'Nevažeći ID korisnika za praćenje.' });
      }

      // Provjeri postoji li već praćenje
      const existingFollow = await followsCollection.findOne({
        followerId: userId,
        followingId: targetUserId
      });

      if (existingFollow) {
        return res.status(409).json({ message: 'Već pratite ovog korisnika.' });
      }

      const result = await followsCollection.insertOne({
        followerId: userId,
        followingId: targetUserId,
        createdAt: new Date().toISOString()
      });

      res.status(201).json({ message: 'Korisnik uspješno zapraćen!', followId: result.insertedId });

    } catch (error) {
      console.error('Greška pri praćenju korisnika:', error);
      res.status(500).json({ message: 'Greška servera pri praćenju.', error: error.message });
    }
  } else if (req.method === 'DELETE') {
    // Otpratite korisnika
    try {
      const { targetUserId } = req.query; // Koristimo query za DELETE zahtjeve

      if (!targetUserId || targetUserId === userId) {
        return res.status(400).json({ message: 'Nevažeći ID korisnika za otpraćivanje.' });
      }

      const result = await followsCollection.deleteOne({
        followerId: userId,
        followingId: targetUserId
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Praćenje nije pronađeno.' });
      }

      res.status(200).json({ message: 'Korisnik uspješno otpraćen!' });

    } catch (error) {
      console.error('Greška pri otpraćivanju korisnika:', error);
      res.status(500).json({ message: 'Greška servera pri otpraćivanju.', error: error.message });
    }
  } else {
    res.status(405).json({ message: 'Metoda nije dozvoljena.' });
  }
});