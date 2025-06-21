// api/users.js
const connectToDatabase = require('./config');
const withAuth = require('./auth');
const { ObjectId } = require('mongodb');
const cors = require('cors');

const allowCors = cors({ methods: ['GET', 'PUT', 'DELETE'], origin: '*' });

module.exports = withAuth(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const currentUserId = req.user ? req.user.userId : null; // ID trenutno prijavljenog korisnika (ako postoji)

    // Parse path to handle different user-related routes
    const pathParts = req.url.split('/').filter(part => part !== '');
    // Expected paths:
    // /api/users
    // /api/users/[id]
    // /api/users/me/following
    // /api/users/[id]/activity
    // /api/users/[id]/follow
    // /api/users/[id]/followers
    // /api/users/[id]/following

    const baseRoute = pathParts[1]; // Should be 'users'
    const userIdInPath = pathParts[2]; // Can be 'me' or an actual ID
    const subRoute = pathParts[3]; // Can be 'following', 'activity', 'follow', 'followers'

    // ================================================================
    // HANDLER ZA DOHVAĆANJE MOJIH PRAĆENJA: /api/users/me/following
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
    if (req.method === 'GET' && !userIdInPath) { // Only /api/users
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
    // HANDLER ZA SPECIFIČNOG KORISNIKA (GET, PUT, DELETE) I PODRUTE
    // ================================================================
    if (userIdInPath && userIdInPath !== 'me') { // If there's an ID in the path (e.g., /api/users/123...)
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
            if (currentUserId !== userIdInPath) {
                return res.status(403).json({ message: 'Nemate dozvolu za ažuriranje statusa drugog korisnika.' });
            }
            try {
                const { loggingOut } = req.body;
                const lastActiveTime = loggingOut ? (Date.now() - 31000) : Date.now(); // Postavi offline 31s unatrag

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
            if (!currentUserId) {
                return res.status(401).json({ message: 'Autorizacijski token nedostaje ili je nevažeći.' });
            }
            if (currentUserId === userIdInPath) {
                return res.status(400).json({ message: 'Ne možete pratiti ili otpratiti samog sebe.' });
            }

            try {
                const targetUserDoc = await usersCollection.findOne({ _id: targetUserId });
                const currentUserDoc = await usersCollection.findOne({ _id: new ObjectId(currentUserId) });

                if (!targetUserDoc || !currentUserDoc) {
                    return res.status(404).json({ message: 'Korisnik nije pronađen.' });
                }

                // Ensure followers and following arrays exist
                targetUserDoc.followers = Array.isArray(targetUserDoc.followers) ? targetUserDoc.followers : [];
                currentUserDoc.following = Array.isArray(currentUserDoc.following) ? currentUserDoc.following : [];


                if (req.method === 'PUT') { // FOLLOW logic
                    if (currentUserDoc.following.includes(userIdInPath)) {
                        return res.status(409).json({ message: 'Već pratite ovog korisnika.' });
                    }

                    await usersCollection.updateOne(
                        { _id: new ObjectId(currentUserId) },
                        { $addToSet: { following: userIdInPath } }
                    );
                    await usersCollection.updateOne(
                        { _id: targetUserId },
                        { $addToSet: { followers: currentUserId } }
                    );
                    return res.status(200).json({ message: 'Korisnik je uspješno zapraćen.' });

                } else if (req.method === 'DELETE') { // UNFOLLOW logic
                    if (!currentUserDoc.following.includes(userIdInPath)) {
                        return res.status(409).json({ message: 'Ne pratite ovog korisnika.' });
                    }

                    await usersCollection.updateOne(
                        { _id: new ObjectId(currentUserId) },
                        { $pull: { following: userIdInPath } }
                    );
                    await usersCollection.updateOne(
                        { _id: targetUserId },
                        { $pull: { followers: currentUserId } }
                    );
                    return res.status(200).json({ message: 'Korisnik više nije praćen.' });
                } else {
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
        if (req.method === 'GET' && !subRoute) { // Only /api/users/[id]
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
        if (req.method === 'PUT' && !subRoute) { // Only /api/users/[id]
            if (currentUserId !== userIdInPath) {
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

                if (slika) {
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

    // Fallback for unsupported methods or paths
    return res.status(405).json({ message: 'Metoda ili ruta nisu dozvoljene.' });
  });
});