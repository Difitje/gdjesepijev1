// api/login.js
const connectToDatabase = require('./config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = cors(async (req, res) => {
  if (req.method === 'POST') {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'Korisničko ime i lozinka su obavezni.' });
      }

      const { db } = await connectToDatabase();
      const usersCollection = db.collection('users');

      const user = await usersCollection.findOne({ username: username.toLowerCase() });
      if (!user) {
        return res.status(401).json({ message: 'Pogrešno korisničko ime ili lozinka.' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Pogrešno korisničko ime ili lozinka.' });
      }

      const token = jwt.sign(
        { userId: user._id.toString(), username: user.username },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const userToSend = {
          id: user._id.toString(),
          ime: user.username,
          slika: user.slika,
          instagram: user.instagram,
          tiktok: user.tiktok,
          opis: user.opis,
          lastActive: user.lastActive
      };

      res.status(200).json({ message: 'Prijava uspješna!', token, user: userToSend });

    } catch (error) {
      console.error('Greška pri prijavi:', error);
      res.status(500).json({ message: 'Greška servera pri prijavi.', error: error.message });
    }
  } else {
    res.status(405).json({ message: 'Metoda nije dozvoljena.' });
  }
});