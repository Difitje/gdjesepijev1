// api/users/[id]/activity.js
const connectToDatabase = require('../../config'); // Putanja od api/users/[id]/activity.js do api/config.js
const withAuth = require('../../auth'); // Putanja od api/users/[id]/activity.js do api/auth.js
const { ObjectId } = require('mongodb');

module.exports = withAuth(async (req, res) => {
  const { id } = req.query;
  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');

  if (req.method === 'PUT') {
    try {
      if (req.user.userId !== id) {
        return res.status(403).json({ message: 'Nemate dozvolu za ažuriranje statusa drugog korisnika.' });
      }

      const { loggingOut } = req.body;
      const lastActiveTime = loggingOut ? (Date.now() - 31000) : Date.now();

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { lastActive: new Date(lastActiveTime).toISOString() } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Korisnik nije pronađen.' });
      }

      res.status(200).json({ message: 'Status aktivnosti ažuriran.' });

    } catch (error) {
      console.error('Greška pri ažuriranju aktivnosti:', error);
      res.status(500).json({ message: 'Greška servera pri ažuriranju aktivnosti.', error: error.message });
    }
  } else {
    res.status(405).json({ message: 'Metoda nije dozvoljena.' });
  }
});