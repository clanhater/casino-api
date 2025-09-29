// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // Buscar el token en la cabecera 'Authorization'
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(403).json({ message: "No se proporcionó un token." });
    }

    // El formato del header es "Bearer <token>"
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: "Token malformado." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: "Token no válido o expirado." });
        }
        // Si el token es válido, guardamos los datos del usuario en el objeto 'req'
        // para que las siguientes funciones puedan usarlo.
        req.user = decoded;
        next(); // Continuar a la siguiente función (el controlador)
    });
};

module.exports = { verifyToken };