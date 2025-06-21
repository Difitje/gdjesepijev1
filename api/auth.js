// api/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (handler) => async (req, res) => {
    // --- Rute koje NE ZAHTIJEVAJU AUTENTIFIKACIJU (public rute) ---
    // Provjeravamo i URL i METODU
    const isRegisterOrLogin = req.url === '/api/register' || req.url === '/api/login';
    const isPublicGetPosts = req.url === '/api/posts' && req.method === 'GET'; // Dohvaćanje svih objava

    // Javne GET rute za korisnike
    const isPublicGetUsersAll = req.url === '/api/users' && req.method === 'GET'; // GET /api/users
    // PROMJENA: isPublicGetSingleUser sada uključuje samo GET metodu za /api/users/[id]
    const isPublicGetSingleUser = req.url.match(/^\/api\/users\/[^/]+$/) && req.method === 'GET'; // GET /api/users/[id]

    // SVE ostale rute (uključujući PUT /api/users/[id]) trebaju biti zaštićene!
    if (isRegisterOrLogin || isPublicGetPosts || isPublicGetUsersAll || isPublicGetSingleUser) {
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

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Dodajemo korisnika u request objekt
        return handler(req, res); // Nastavi na sljedeći middleware/funkciju
    } catch (error) {
        console.error("Greška pri verifikaciji tokena:", error);
        return res.status(401).json({ message: 'Token je nevažeći ili istekao.' });
    }
};