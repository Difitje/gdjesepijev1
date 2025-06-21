// api/users/[id].js
const connectToDatabase = require('../config');
const withAuth = require('../auth');
const { ObjectId } = require('mongodb'); // Potrebno za ObjectId konverziju
const cors = require('cors');

const allowCors = cors({ methods: ['GET', 'PUT'], origin: '*' });

module.exports = withAuth(async (req, res) => {
  // CORS preflight zahtjevi
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  // Glavna logika funkcije
  return allowCors(req, res, async () => {
    const { id } = req.query; // Dohvaća ID iz URL-a (npr. '684f0a30bc142c76b94fcce4')
    console.log(`[users/[id]] Pokrenuta funkcija za ID: ${id}`); // LOGIRAJ ID

    let db; // Deklariraj varijablu za bazu podataka izvan try/catch bloka

    try {
      // Spoji se na bazu podataka
      ({ db } = await connectToDatabase());
      const usersCollection = db.collection('users');
      console.log(`[users/[id]] Uspješno povezan na bazu.`); // LOGIRAJ USPJEŠNU KONEKCIJU

      if (req.method === 'GET') {
        let objectId;
        try {
          // Pokušaj konvertirati string ID u MongoDB ObjectId
          objectId = new ObjectId(id);
          console.log(`[users/[id]] ID uspješno konvertiran u ObjectId: ${objectId}`); // LOGIRAJ USPJEH KONVERZIJE
        } catch (oidError) {
          // Uhvati grešku ako ID nije u ispravnom formatu za ObjectId
          console.error(`[users/[id]] GREŠKA KONVERZIJE ID-a '${id}': ${oidError.message}`); // KLJUČNI LOG GREŠKE
          // Vrati 400 Bad Request ako ID nije validan
          return res.status(400).json({ message: 'Nevažeći format korisničkog ID-a.', error: oidError.message });
        }

        // Dohvati korisnika iz baze
        const user = await usersCollection.findOne({ _id: objectId }, { projection: { password: 0 } });
        console.log(`[users/[id]] Rezultat upita za korisnika s ID ${id}: ${user ? 'Pronađen' : 'Nije pronađen'}`); // LOGIRAJ REZULTAT UPITA

        if (!user) {
          // Ako korisnik nije pronađen
          return res.status(404).json({ message: 'Korisnik nije pronađen.' });
        }
        
        // Pripremi podatke korisnika za slanje frontendu
        const userToSend = {
            id: user._id.toString(), // Pretvaranje ObjectId u string za frontend
            ime: user.username,
            slika: user.slika,
            instagram: user.instagram,
            tiktok: user.tiktok,
            opis: user.opis,
            lastActive: user.lastActive
        };
        console.log(`[users/[id]] Slanje podataka korisnika: ${user.username}`); // LOGIRAJ USPJEŠAN ODGOVOR
        res.status(200).json(userToSend);

      } else if (req.method === 'PUT') { // Logika za ažuriranje profila
          console.log(`[users/[id]] Primljen PUT zahtjev za ID: ${id}`);
          // Trenutni korisnik iz tokena mora biti isti kao korisnik čiji se profil mijenja
          if (req.user.userId !== id) {
              return res.status(403).json({ message: 'Nemate dozvolu za uređivanje ovog profila.' });
          }

          const { username, opis, instagram, tiktok, slika } = req.body;
          const updateData = {
              opis: opis || '',
              instagram: instagram || '',
              tiktok: tiktok || ''
          };

          // Ažuriraj korisničko ime samo ako je poslano i nije već zauzeto
          if (username && username.toLowerCase() !== req.user.username.toLowerCase()) {
              const existingUser = await usersCollection.findOne({ username: username.toLowerCase() });
              if (existingUser) {
                  return res.status(409).json({ message: 'Novo korisničko ime je već zauzeto!' });
              }
              updateData.username = username.toLowerCase();
          }

          if (slika) { // Ako je poslana nova slika
              updateData.slika = slika;
          }

          const result = await usersCollection.updateOne(
              { _id: new ObjectId(id) }, // Koristi objectId ovdje
              { $set: updateData }
          );

          if (result.matchedCount === 0) {
              return res.status(404).json({ message: 'Korisnik nije pronađen.' });
          }

          res.status(200).json({ message: 'Profil uspješno ažuriran.' });

      } else { // Nedozvoljena metoda
        res.status(405).json({ message: 'Metoda nije dozvoljena.' });
      }
    } catch (error) {
      // Uhvati bilo koju neočekivanu grešku unutar funkcije
      console.error('[users/[id]] NEOČEKIVANA GREŠKA U FUNKCIJI:', error); // KLJUČNI LOG GREŠKE
      res.status(500).json({ message: 'Greška servera pri dohvaćanju/ažuriranju korisnika (opći catch blok).', error: error.message });
    }
  });
});