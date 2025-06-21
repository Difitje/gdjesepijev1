// api/users/[id].js
const connectToDatabase = require('../../config'); // Putanja od api/users/[id].js do api/config.js
const withAuth = require('../../auth'); // Putanja od api/users/[id].js do api/auth.js
const { ObjectId } = require('mongodb');
const cors = require('cors');

const allowCors = cors({ methods: ['GET', 'PUT'], origin: '*' }); // Dozvoli GET i PUT za ovu funkciju

module.exports = withAuth(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    const { id } = req.query; // Dohvaća ID iz URL-a (npr. '684f0a30bc142c76b94fcce4')
    let db;

    try {
      ({ db } = await connectToDatabase());
      const usersCollection = db.collection('users');
      let objectId;

      try {
        objectId = new ObjectId(id); // Konvertiraj string ID u MongoDB ObjectId
      } catch (oidError) {
        return res.status(400).json({ message: 'Nevažeći format korisničkog ID-a.', error: oidError.message });
      }

      if (req.method === 'GET') { // Logika za dohvaćanje jednog korisnika
        const user = await usersCollection.findOne({ _id: objectId }, { projection: { password: 0 } });
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

      } else if (req.method === 'PUT') { // Logika za AŽURIRANJE PROFILA
          // Provjeri da je prijavljeni korisnik vlasnik profila koji se mijenja
          if (req.user.userId !== id) {
              return res.status(403).json({ message: 'Nemate dozvolu za uređivanje ovog profila.' });
          }

          const { username, opis, instagram, tiktok, slika } = req.body;
          const updateData = {
              opis: opis || '',
              instagram: instagram || '',
              tiktok: tiktok || ''
          };

          // Ažuriraj korisničko ime samo ako je poslano i nije već zauzeto (i ako je drugačije)
          if (username && username.toLowerCase() !== req.user.username.toLowerCase()) {
              const existingUser = await usersCollection.findOne({ username: username.toLowerCase() });
              if (existingUser) {
                  return res.status(409).json({ message: 'Novo korisničko ime je već zauzeto!' });
              }
              updateData.username = username.toLowerCase();
          }

          if (slika) { // Ako je poslana nova slika, uključi je u update
              updateData.slika = slika;
          }

          const result = await usersCollection.updateOne(
              { _id: objectId },
              { $set: updateData }
          );

          if (result.matchedCount === 0) {
              return res.status(404).json({ message: 'Korisnik nije pronađen.' });
          }

          res.status(200).json({ message: 'Profil uspješno ažuriran.' });

      } else { // Ako metoda nije ni GET ni PUT za ovaj [id].js endpoint
        res.status(405).json({ message: 'Metoda nije dozvoljena za ovu rutu.' });
      }
    } catch (error) {
      console.error('Greška pri dohvaćanju/ažuriranju korisnika:', error);
      res.status(500).json({ message: 'Greška servera pri obradi zahtjeva.', error: error.message });
    }
  });
});