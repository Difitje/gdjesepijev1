// api/posts.js
// OVO JE SAMO ZA DIJAGNOSTIKU!
// Ovaj kod samo vraća uspješan odgovor, bez baze ili autentifikacije.
// NEMOJTE GA OSTAVITI TRAJNO!

const cors = require('cors');

// Inicijaliziraj CORS middleware za ovu funkciju
const allowCors = cors({ methods: ['GET', 'POST', 'DELETE'], origin: '*' });

module.exports = async (req, res) => {
  // Prvo, obradi CORS preflight zahtjeve (OPTIONS metoda)
  if (req.method === 'OPTIONS') {
    return allowCors(req, res, () => res.status(200).end());
  }

  // Zatim, primijeni CORS na stvarni zahtjev i pokreni logiku
  return allowCors(req, res, async () => {
    try {
      console.log("api/posts: Funkcija je pokrenuta!"); // Ovo bi se MORALO pojaviti u logovima

      if (req.method === 'POST') {
        console.log("api/posts: Primljen POST zahtjev."); // I ovo
        // Ne radimo ništa s tijelom zahtjeva niti s bazom
        res.status(200).json({ message: "TEST: Objava uspješna (backend radi osnovno)!" });
      } else if (req.method === 'GET') {
        console.log("api/posts: Primljen GET zahtjev.");
        res.status(200).json([]); // Vraća prazan niz za test
      } else if (req.method === 'DELETE') {
        console.log("api/posts: Primljen DELETE zahtjev.");
        res.status(200).json({ message: "TEST: Brisanje uspješno (backend radi osnovno)!" });
      } else {
        res.status(405).json({ message: 'Metoda nije dozvoljena.' });
      }
    } catch (error) {
      console.error('api/posts: Neočekivana greška u catch bloku:', error); // Ovo ako pukne
      res.status(500).json({ message: 'api/posts: Greška servera u catch bloku.', error: error.message });
    }
  });
};