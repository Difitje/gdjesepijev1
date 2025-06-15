// api/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (handler) => async (req, res) => {
    // Rute koje ne zahtijevaju autentifikaciju:
    //  - /api/register (za registraciju)
    //  - /api/login (za prijavu)
    //  - /api/users (za dohvaćanje liste svih korisnika - ako želite da je javno dostupno)
    //  - /api/posts (za dohvaćanje svih objava - ako želite da je javno dostupno)
    //  - /api/users/[id] (za dohvaćanje pojedinog profila - ako želite da je javno dostupno)
    if (req.url === '/api/register' || req.url === '/api/login' || req.url === '/api/users' || req.url.startsWith('/api/users/') || req.url === '/api/posts' || req.url.startsWith('/api/posts/')) {
        return handler(req, res);
    }

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
        return handler(req, res);
    } catch (error) {
        console.error("Greška pri verifikaciji tokena:", error);
        return res.status(401).json({ message: 'Token je nevažeći ili istekao.' });
    }
};