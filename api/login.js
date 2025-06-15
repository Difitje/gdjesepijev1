// api/login.js
const connectToDatabase = require('./config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Inicijaliziraj CORS middleware za ovu funkciju
// Dozvoljavamo samo POST metodu za prijavu
const allowCors = cors({ methods: ['POST'], origin: '*' });

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
  // Prvo, obradi CORS preflight zahtjeve (OPTIONS metoda)
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  // Zatim, primijeni CORS na stvarni zahtjev i pokreni logiku
  return allowCors(req, res, async () => {
    if (req.method === 'POST') {
      try {
        const { username, password } = req.body;

        if (!username || !password) {
          if (!res.status) { console.error("res.status is missing before 400!"); return res.end(JSON.stringify({ message: 'res.status missing: Korisničko ime i lozinka su obavezni.' })); }
          return res.status(400).json({ message: 'Korisničko ime i lozinka su obavezni.' });
        }

        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({ username: username.toLowerCase() });
        if (!user) {
          if (!res.status) { console.error("res.status is missing before 401!"); return res.end(JSON.stringify({ message: 'res.status missing: Pogrešno korisničko ime ili lozinka.' })); }
          return res.status(401).json({ message: 'Pogrešno korisničko ime ili lozinka.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          if (!res.status) { console.error("res.status is missing before 401 (password)!"); return res.end(JSON.stringify({ message: 'res.status missing: Pogrešno korisničko ime ili lozinka (password).' })); }
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

        if (!res.status) { console.error("res.status is missing before 200!"); return res.end(JSON.stringify({ message: 'res.status missing: Prijava uspješna!' })); }
        res.status(200).json({ message: 'Prijava uspješna!', token, user: userToSend });

      } catch (error) {
        console.error('Greška pri prijavi:', error);
        if (!res.status) { console.error("res.status is missing before 500!"); return res.end(JSON.stringify({ message: 'res.status missing: Greška servera pri prijavi.', error: error.message })); }
        res.status(500).json({ message: 'Greška servera pri prijavi.', error: error.message });
      }
    } else {
      if (!res.status) { console.error("res.status is missing before 405!"); return res.end(JSON.stringify({ message: 'res.status missing: Metoda nije dozvoljena.' })); }
      res.status(405).json({ message: 'Metoda nije dozvoljena.' });
    }
  });
};