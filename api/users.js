// api/users.js
const connectToDatabase = require('./config');
const withAuth = require('./auth');
const { ObjectId } = require('mongodb');
const cors = require('cors');

// Promijenjeno: methods: '*' da dopusti sve metode za CORS
const allowCors = cors({ methods: '*', origin: '*' });

module.exports = withAuth(async (req, res) => {
  // CORS preflight zahtjevi
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  // Glavna logika funkcije
  return allowCors(req, res, async () => {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const currentUserId = req.user ? req.user.userId : null; // ID trenutno prijavljenog korisnika (ako postoji)

    // NOVO: Parseirajte URL robustnije
    const url = new URL(req.url, `http://${req.headers.host}`); // Kreira puni URL objekt
    const pathSegments = url.pathname.split('/').filter(Boolean); // Podijeli pathname i ukloni prazne segmente

    // Expected structure for pathSegments: ['api', 'users', ':id', 'subroute']
    // Example: ['api', 'users'], ['api', 'users', 'me', 'following'], ['api', 'users', 'someId', 'follow']

    // Provjeri da li putanja počinje s 'api/users'
    if (pathSegments[0] !== 'api' || pathSegments[1] !== 'users') {
        return res.status(400).json({ message: 'Nevažeća API ruta.' });
    }

    const userIdInPath = pathSegments[2]; // Može biti 'me' ili stvarni ID
    const subRoute = pathSegments[3]; // Može biti 'following', 'activity', 'follow', 'followers'

    // ================================================================
    // HANDLER ZA DOHVAĆANJE MOJIH PRAĆENJA: /api/users/me/following (GET)
    // ================================================================
    if (req.method === 'GET' && userIdInPath === 'me' && subRoute === 'following') {
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

    // ================================================================
    // HANDLER ZA DOHVAĆANJE SVIH KORISNIKA: /api/users (GET)
    // ================================================================
    // Provjeravamo da nema userIdInPath niti subRoute, tj. samo /api/users
    if (req.method === 'GET' && !userIdInPath && !subRoute) {
      try {
        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
        const usersToSend = users.map(user => ({
            id: user._id.toString(),
            ime: user.username,
            slika: user.slika,
            instagram: user.instagram,
            tiktok: user.tiktok,
            opis: user.opis,
            lastActive: user.lastActive
        }));
        return res.status(200).json(usersToSend);
      } catch (error) {
        console.error('Greška pri dohvaćanju svih korisnika (api/users):', error);
        return res.status(500).json({ message: 'Greška servera pri dohvaćanju korisnika.', error: error.message });
      }
    }

    // ================================================================
    // HANDLER ZA SPECIFIČNOG KORISNIKA I PODRUTE
    // Ovo će se pokrenuti ako userIdInPath postoji i nije 'me'
    // ================================================================
    if (userIdInPath && userIdInPath !== 'me') {
        let targetUserId;
        try {
            targetUserId = new ObjectId(userIdInPath);
        } catch (oidError) {
            return res.status(400).json({ message: 'Nevažeći format korisničkog ID-a.', error: oidError.message });
        }

        // ================================================================
        // AŽURIRANJE AKTIVNOSTI: /api/users/[id]/activity (PUT)
        // ================================================================
        if (req.method === 'PUT' && subRoute === 'activity') {
            // Provjera autorizacije za ažuriranje aktivnosti
            if (!currentUserId || currentUserId !== userIdInPath) {
                return res.status(403).json({ message: 'Nemate dozvolu za ažuriranje statusa drugog korisnika.' });
            }
            try {
                const { loggingOut } = req.body;
                // Postavi lastActive 31s unatrag ako se odjavljuje, inače trenutno vrijeme
                const lastActiveTime = loggingOut ? (Date.now() - 31000) : Date.now();

                const result = await usersCollection.updateOne(
                    { _id: targetUserId },
                    { $set: { lastActive: new Date(lastActiveTime).toISOString() } }
                );
                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'Korisnik nije pronađen.' });
                }
                return res.status(200).json({ message: 'Status aktivnosti ažuriran.' });
            } catch (error) {
                console.error('Greška pri ažuriranju aktivnosti:', error);
                return res.status(500).json({ message: 'Greška servera pri ažuriranju aktivnosti.', error: error.message });
            }
        }

        // ================================================================
        // PRATI / OTPRATI: /api/users/[id]/follow (PUT / DELETE)
        // ================================================================
        if (subRoute === 'follow') {
            // Provjera da li je korisnik prijavljen
            if (!currentUserId) {
                return res.status(401).json({ message: 'Autorizacijski token nedostaje ili je nevažeći.' });
            }
            // Provjera da li korisnik pokušava pratiti/otpratiti samog sebe
            if (currentUserId === userIdInPath) {
                return res.status(400).json({ message: 'Ne možete pratiti ili otpratiti samog sebe.' });
            }

            try {
                // Dohvati dokumente ciljanog i trenutnog korisnika
                const targetUserDoc = await usersCollection.findOne({ _id: targetUserId });
                const currentUserDoc = await usersCollection.findOne({ _id: new ObjectId(currentUserId) });

                if (!targetUserDoc || !currentUserDoc) {
                    return res.status(404).json({ message: 'Korisnik nije pronađen.' });
                }

                // Osigurajte da su polja 'followers' i 'following' uvijek nizovi
                targetUserDoc.followers = Array.isArray(targetUserDoc.followers) ? targetUserDoc.followers : [];
                currentUserDoc.following = Array.isArray(currentUserDoc.following) ? currentUserDoc.following : [];


                if (req.method === 'PUT') { // Logika za PRAĆENJE
                    // Provjera da li već prati
                    if (currentUserDoc.following.includes(userIdInPath)) {
                        return res.status(409).json({ message: 'Već pratite ovog korisnika.' });
                    }

                    // Dodaj ciljanog korisnika u 'following' listu trenutnog korisnika
                    await usersCollection.updateOne(
                        { _id: new ObjectId(currentUserId) },
                        { $addToSet: { following: userIdInPath } } // $addToSet sprječava duplikate
                    );
                    // Dodaj trenutnog korisnika u 'followers' listu ciljanog korisnika
                    await usersCollection.updateOne(
                        { _id: targetUserId },
                        { $addToSet: { followers: currentUserId } }
                    );
                    return res.status(200).json({ message: 'Korisnik je uspješno zapraćen.' });

                } else if (req.method === 'DELETE') { // Logika za OTPRAĆIVANJE
                    // Provjera da li uopće prati
                    if (!currentUserDoc.following.includes(userIdInPath)) {
                        return res.status(409).json({ message: 'Ne pratite ovog korisnika.' });
                    }

                    // Ukloni ciljanog korisnika iz 'following' liste trenutnog korisnika
                    await usersCollection.updateOne(
                        { _id: new ObjectId(currentUserId) },
                        { $pull: { following: userIdInPath } } // $pull uklanja element iz niza
                    );
                    // Ukloni trenutnog korisnika iz 'followers' liste ciljanog korisnika
                    await usersCollection.updateOne(
                        { _id: targetUserId },
                        { $pull: { followers: currentUserId } }
                    );
                    return res.status(200).json({ message: 'Korisnik više nije praćen.' });
                } else {
                    // Metoda nije PUT ni DELETE
                    return res.status(405).json({ message: 'Metoda nije dozvoljena za /follow rutu.' });
                }
            } catch (error) {
                console.error(`Greška pri obradi follow/unfollow zahtjeva (${req.method}):`, error);
                return res.status(500).json({ message: 'Greška servera pri obradi zahtjeva.', error: error.message });
            }
        }

        // ================================================================
        // DOHVAĆANJE PRATITELJA: /api/users/[id]/followers (GET)
        // ================================================================
        if (req.method === 'GET' && subRoute === 'followers') {
            try {
                const user = await usersCollection.findOne({ _id: targetUserId });
                if (!user) {
                    return res.status(404).json({ message: 'Korisnik nije pronađen.' });
                }
                const followers = Array.isArray(user.followers) ? user.followers : [];
                return res.status(200).json(followers);
            } catch (error) {
                console.error('Greška pri dohvaćanju pratitelja:', error);
                return res.status(500).json({ message: 'Greška servera pri dohvaćanju pratitelja.', error: error.message });
            }
        }

        // ================================================================
        // DOHVAĆANJE PRAĆENJA: /api/users/[id]/following (GET)
        // ================================================================
        if (req.method === 'GET' && subRoute === 'following') {
            try {
                const user = await usersCollection.findOne({ _id: targetUserId });
                if (!user) {
                    return res.status(404).json({ message: 'Korisnik nije pronađen.' });
                }
                const following = Array.isArray(user.following) ? user.following : [];
                return res.status(200).json(following);
            } catch (error) {
                console.error('Greška pri dohvaćanju praćenja:', error);
                return res.status(500).json({ message: 'Greška servera pri dohvaćanju praćenja.', error: error.message });
            }
        }

        // ================================================================
        // DOHVAĆANJE JEDNOG KORISNIKA: /api/users/[id] (GET)
        // ================================================================
        // Ovo će se pokrenuti ako userIdInPath postoji i nema subRoute
        if (req.method === 'GET' && !subRoute) {
            try {
                const user = await usersCollection.findOne({ _id: targetUserId }, { projection: { password: 0 } });
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
            } catch (error) {
                console.error('Greška pri dohvaćanju jednog korisnika:', error);
                return res.status(500).json({ message: 'Greška servera pri dohvaćanju korisnika.', error: error.message });
            }
        }

        // ================================================================
        // AŽURIRANJE PROFILA: /api/users/[id] (PUT)
        // ================================================================
        // Ovo će se pokrenuti ako userIdInPath postoji i nema subRoute
        if (req.method === 'PUT' && !subRoute) {
            // Provjera autorizacije za ažuriranje profila
            if (!currentUserId || currentUserId !== userIdInPath) {
                return res.status(403).json({ message: 'Nemate dozvolu za uređivanje ovog profila.' });
            }
            try {
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

                if (slika) { // Ako je poslana nova slika
                    updateData.slika = slika;
                }

                const result = await usersCollection.updateOne(
                    { _id: targetUserId },
                    { $set: updateData }
                );
                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'Korisnik nije pronađen.' });
                }
                return res.status(200).json({ message: 'Profil uspješno ažuriran.' });
            } catch (error) {
                console.error('Greška pri ažuriranju profila:', error);
                return res.status(500).json({ message: 'Greška servera pri ažuriranju profila.', error: error.message });
            }
        }
    }

    // Fallback za metode ili rute koje nisu podržane ni jednim od gornjih handler-a
    return res.status(405).json({ message: 'Metoda ili ruta nisu dozvoljene.' });
  });
});