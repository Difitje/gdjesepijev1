// Ispravljena verzija: api/users/[id].js
const connectToDatabase = require('../config');
const withAuth = require('../auth');
const { ObjectId } = require('mongodb');

// Glavna funkcija koja se izvozi
module.exports = async (req, res) => {
  // Prvo i najvažnije: Odmah obradi CORS preflight zahtjev bez autentifikacije
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  // Nakon što je OPTIONS obrađen, primijeni `withAuth` na ostale zahtjeve
  // `withAuth` će obraditi zahtjev i ako je sve u redu, pozvat će našu glavnu logiku
  return withAuth(async (req, res) => {
    const { id } = req.query;
    
    // Potrebno je da i front-end šalje odgovarajuće headere
    res.setHeader('Access-Control-Allow-Origin', '*'); 

    try {
      const { db } = await connectToDatabase();
      const usersCollection = db.collection('users');

      // Logika za dohvaćanje korisnika
      if (req.method === 'GET') {
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
        return res.status(200).json(userToSend);
      }

      // Logika za ažuriranje profila
      if (req.method === 'PUT') {
        if (req.user.userId !== id) {
          return res.status(403).json({ message: 'Nemate dozvolu za uređivanje ovog profila.' });
        }

        const { username, opis, instagram, tiktok, slika } = req.body;
        const updateData = {};

        if (opis !== undefined) updateData.opis = opis;
        if (instagram !== undefined) updateData.instagram = instagram;
        if (tiktok !== undefined) updateData.tiktok = tiktok;
        if (slika) updateData.slika = slika;

        if (username && username.toLowerCase() !== req.user.username.toLowerCase()) {
          const existingUser = await usersCollection.findOne({ username: { $regex: `^${username}$`, $options: 'i' } });
          if (existingUser && existingUser._id.toString() !== id) {
              return res.status(409).json({ message: 'Korisničko ime je već zauzeto!' });
          }
          updateData.username = username;
        }

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Korisnik nije pronađen.' });
        }

        return res.status(200).json({ message: 'Profil uspješno ažuriran.' });
      }

      // Ako metoda nije ni GET ni PUT (ni OPTIONS koji je već obrađen)
      res.setHeader('Allow', ['GET', 'PUT', 'OPTIONS']);
      return res.status(405).json({ message: `Metoda ${req.method} nije dozvoljena.` });

    } catch (error) {
      console.error(`[users/[id]] Greška u obradi za ID ${id}:`, error);
      // Provjeri je li greška zbog neispravnog ID formata
      if (error.name === 'BSONError') {
          return res.status(400).json({ message: 'Nevažeći format korisničkog ID-a.' });
      }
      return res.status(500).json({ message: 'Greška na serveru.', error: error.message });
    }
  })(req, res); // Odmah pozivamo `withAuth` s (req, res)
};