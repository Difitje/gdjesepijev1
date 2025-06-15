// api/users/[id].js
const connectToDatabase = require('../config'); // Putanja od api/users/[id].js do api/config.js
const withAuth = require('../auth'); // Putanja od api/users/[id].js do api/auth.js
const { ObjectId } = require('mongodb');

module.exports = withAuth(async (req, res) => {
  const { id } = req.query; // Dohvaća [id] iz URL-a
  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');

  if (req.method === 'GET') {
    try {
      const user = await usersCollection.findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });
      if (!user) {
        return res.status(404).json({ message: 'Korisnik nije pronađen.' });
      }
      const userToSend = {
          id: user._id.toString(),
          ime: user.username,
          slika: user.slika,
          instagram: user.instagram,
          tiktok: user.tiktok,
          opis: user.opis,
          lastActive: user.lastActive
      };
      res.status(200).json(userToSend);
    } catch (error) {
      console.error('Greška pri dohvaćanju pojedinog korisnika:', error);
      res.status(500).json({ message: 'Greška servera pri dohvaćanju korisnika.', error: error.message });
    }
  } else if (req.method === 'PUT') { // Za ažuriranje profila
      try {
          if (req.user.userId !== id) {
              return res.status(403).json({ message: 'Nemate dozvolu za uređivanje ovog profila.' });
          }

          const { username, opis, instagram, tiktok, slika } = req.body;
          const updateData = {
              opis: opis || '',
              instagram: instagram || '',
              tiktok: tiktok || ''
          };

          if (username && username.toLowerCase() !== req.user.username.toLowerCase()) {
              const existingUser = await usersCollection.findOne({ username: username.toLowerCase() });
              if (existingUser) {
                  return res.status(409).json({ message: 'Novo korisničko ime je već zauzeto!' });
              }
              updateData.username = username.toLowerCase();
          }

          if (slika) {
              updateData.slika = slika;
          }

          const result = await usersCollection.updateOne(
              { _id: new ObjectId(id) },
              { $set: updateData }
          );

          if (result.matchedCount === 0) {
              return res.status(404).json({ message: 'Korisnik nije pronađen.' });
          }

          res.status(200).json({ message: 'Profil uspješno ažuriran.' });

      } catch (error) {
          console.error('Greška pri ažuriranju profila:', error);
          res.status(500).json({ message: 'Greška servera pri ažuriranju profila.', error: error.message });
      }
  } else {
    res.status(405).json({ message: 'Metoda nije dozvoljena.' });
  }
});