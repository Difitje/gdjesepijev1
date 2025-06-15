// api/posts.js
const connectToDatabase = require('./config');
const withAuth = require('./auth');
const { ObjectId } = require('mongodb');
const cors = require('cors');

const allowCors = cors({ methods: ['GET', 'POST', 'DELETE'], origin: '*' });

module.exports = withAuth(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  return allowCors(req, res, async () => {
    const { db } = await connectToDatabase();
    const postsCollection = db.collection('posts');

    if (req.method === 'GET') {
      try {
        const posts = await postsCollection.find({}).sort({ createdAt: -1 }).toArray();

        // VAŽNO: Mapiraj _id u id za frontend
        const postsToSend = posts.map(post => ({
            ...post,
            id: post._id.toString(), // Dodaj 'id' property kao string od _id
            korisnikId: post.korisnikId.toString() // Osiguraj da je korisnikId string ako je ObjectId
        }));

        if (!res.status) { console.error("res.status is missing before GET posts!"); return res.end(JSON.stringify({ message: 'res.status missing: Greška servera pri dohvaćanju objava.' })); }
        res.status(200).json(postsToSend);
      } catch (error) {
        console.error('Greška pri dohvaćanju objava:', error);
        if (!res.status) { console.error("res.status is missing before GET posts error!"); return res.end(JSON.stringify({ message: 'res.status missing: Greška servera pri dohvaćanju objava.', error: error.message })); }
        res.status(500).json({ message: 'Greška servera pri dohvaćanju objava.', error: error.message });
      }
    } else if (req.method === 'POST') {
      try {
        const { opis, lat, lon } = req.body;
        const korisnikId = req.user.userId;

        if (!opis || lat === undefined || lon === undefined) {
          if (!res.status) { console.error("res.status is missing before POST posts 400!"); return res.end(JSON.stringify({ message: 'res.status missing: Opis, latituda i longituda su obavezni.' })); }
          return res.status(400).json({ message: 'Opis, latituda i longituda su obavezni.' });
        }

        await postsCollection.deleteMany({ korisnikId: korisnikId });

        const newPost = {
          korisnikId: korisnikId,
          opis,
          lat,
          lon,
          createdAt: new Date().toISOString()
        };

        const result = await postsCollection.insertOne(newPost);
        if (!res.status) { console.error("res.status is missing before POST posts 201!"); return res.end(JSON.stringify({ message: 'res.status missing: Pijanka uspješno objavljena!', postId: result.insertedId })); }
        res.status(201).json({ message: 'Pijanka uspješno objavljena!', postId: result.insertedId });
      } catch (error) {
        console.error('Greška pri objavi pijanke:', error);
        if (!res.status) { console.error("res.status is missing before POST posts error!"); return res.end(JSON.stringify({ message: 'res.status missing: Greška servera pri objavi pijanke.', error: error.message })); }
        res.status(500).json({ message: 'Greška servera pri objavi pijanke.', error: error.message });
      }
    } else if (req.method === 'DELETE') {
      try {
        const { postId } = req.query;
        const korisnikId = req.user.userId;

        if (!postId) {
            if (!res.status) { console.error("res.status is missing before DELETE posts 400!"); return res.end(JSON.stringify({ message: 'res.status missing: ID objave je obavezan za brisanje.' })); }
            return res.status(400).json({ message: 'ID objave je obavezan za brisanje.' });
        }

        const result = await postsCollection.deleteOne({ _id: new ObjectId(postId), korisnikId: korisnikId });

        if (result.deletedCount === 0) {
            if (!res.status) { console.error("res.status is missing before DELETE posts 404!"); return res.end(JSON.stringify({ message: 'res.status missing: Objava nije pronađena ili niste vlasnik.' })); }
            return res.status(404).json({ message: 'Objava nije pronađena ili niste vlasnik.' });
        }

        if (!res.status) { console.error("res.status is missing before DELETE posts 200!"); return res.end(JSON.stringify({ message: 'res.status missing: Objava uspješno obrisana.' })); }
        res.status(200).json({ message: 'Objava uspješno obrisana.' });

      } catch (error) {
        console.error('Greška pri brisanju objave:', error);
        if (!res.status) { console.error("res.status is missing before DELETE posts error!"); return res.end(JSON.stringify({ message: 'res.status missing: Greška servera pri brisanju objave.', error: error.message })); }
        res.status(500).json({ message: 'Greška servera pri brisanju objave.', error: error.message });
      }
    } else {
      if (!res.status) { console.error("res.status is missing before posts 405!"); return res.end(JSON.stringify({ message: 'res.status missing: Metoda nije dozvoljena.' })); }
      res.status(405).json({ message: 'Metoda nije dozvoljena.' });
    }
  });
});