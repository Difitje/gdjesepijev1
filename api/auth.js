// api/auth.js
const jwt = require('jsonwebtoken');

// PROMIJENJENO: Ime varijable okoline mora se podudarati s onim na Vercelu
const JWT_SECRET = process.env.super_tajni_kljuc_koji_je_vrlo_dugacak_i_nasumican; 

module.exports = (handler) => async (req, res) => {
    // --- Rute koje NE ZAHTIJEVAJU AUTENTIFIKACIJU (public rute) ---
    // Provjeravamo i URL i METODU
    const isPublicGetUsers = req.url === '/api/users' && req.method === 'GET';
    const isPublicGetSingleUser = req.url.match(/^\/api\/users\/[^/]+$/) && req.method === 'GET';
    const isRegisterOrLogin = req.url === '/api/register' || req.url === '/api/login';
    const isPublicGetPosts = req.url === '/api/posts' && req.method === 'GET';


    if (isRegisterOrLogin || isPublicGetUsers || isPublicGetSingleUser || isPublicGetPosts) {
        // Ove rute zaobilaze autentifikaciju i idu direktno na handler
        return handler(req, res);
    }

    // --- Rute koje ZAHTIJEVAJU AUTENTIFIKACIJU (sve ostale) ---
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'Autorizacijski token nedostaje.' });
    }

    const token = authHeader.split(' ')[1]; // Format: Bearer TOKEN
    if (!token) {
        return res.status(401).json({ message: 'Format tokena nije ispravan.' });
    }

    // DODATNA PROVJERA: Ako ključ nije definiran, to je greška u konfiguraciji
    if (!JWT_SECRET) {
        console.error("Greška: JWT_SECRET varijabla okoline nije ispravno učitana!");
        return res.status(500).json({ message: 'Greška servera: Konfiguracija autentifikacije nije ispravna.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Dodajemo korisnika u request objekt
        return handler(req, res); // Nastavi na sljedeći middleware/funkciju
    } catch (error) {
        console.error("Greška pri verifikaciji tokena:", error);
        // Ovdje možete dodati detaljnije poruke na temelju tipa greške
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token je istekao. Molimo prijavite se ponovo.' });
        } else if (error.name === 'JsonWebTokenError') {
            // Npr. "invalid signature", "jwt malformed" itd.
            return res.status(403).json({ message: 'Nevažeći token.' });
        }
        return res.status(401).json({ message: 'Autentifikacija neuspjela.' });
    }
};