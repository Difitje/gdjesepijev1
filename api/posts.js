// api/posts.js
const connectToDatabase = require('./config');
const withAuth = require('./auth');
const { ObjectId } = require('mongodb');

module.exports = withAuth(async (req, res) => {
  const { db } = await connectToDatabase();
  const postsCollection = db.collection('posts');

  if (req.method === 'GET') {
    try {
      const posts = await postsCollection.find({}).sort({ createdAt: -1 }).toArray();
      res.status(200).json(posts);
    } catch (error) {
      console.error('Greška pri dohvaćanju objava:', error);
      res.status(500).json({ message: 'Greška servera pri dohvaćanju objava.', error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { opis, lat, lon } = req.body;
      const korisnikId = req.user.userId;

      if (!opis || lat === undefined || lon === undefined) {
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
      res.status(201).json({ message: 'Pijanka uspješno objavljena!', postId: result.insertedId });
    } catch (error) {
      console.error('Greška pri objavi pijanke:', error);
      res.status(500).json({ message: 'Greška servera pri objavi pijanke.', error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { postId } = req.query; // Dohvati ID iz query parametra
      const korisnikId = req.user.userId;

      if (!postId) {
          return res.status(400).json({ message: 'ID objave je obavezan za brisanje.' });
      }

      const result = await postsCollection.deleteOne({ _id: new ObjectId(postId), korisnikId: korisnikId });

      if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Objava nije pronađena ili niste vlasnik.' });
      }

      res.status(200).json({ message: 'Objava uspješno obrisana.' });

    } catch (error) {
      console.error('Greška pri brisanju objave:', error);
      res.status(500).json({ message: 'Greška servera pri brisanju objave.', error: error.message });
    }
  }
  else {
    res.status(405).json({ message: 'Metoda nije dozvoljena.' });
  }
});