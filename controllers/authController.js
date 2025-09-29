// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/database.js');



// --- FUNCIÓN DE REGISTRO ---
const register = (req, res) => {
    const { username, password } = req.body;

    // Validación básica
    if (!username || !password) {
        return res.status(400).json({ message: "El nombre de usuario y la contraseña son obligatorios." });
    }

    // Hashear la contraseña antes de guardarla
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const sql = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';
    const params = [username, password_hash];

    db.run(sql, params, function(err) {
        if (err) {
            // El código 19 corresponde a una violación de la restricción UNIQUE (username repetido)
            if (err.errno === 19) {
                return res.status(409).json({ message: "El nombre de usuario ya existe." });
            }
            return res.status(500).json({ message: "Error al registrar el usuario.", error: err.message });
        }
        res.status(201).json({ message: "Usuario registrado con éxito.", userId: this.lastID });
    });
};

// --- FUNCIÓN DE LOGIN ---
const login = (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "El nombre de usuario y la contraseña son obligatorios." });
    }

    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], (err, user) => {
        if (err) {
            return res.status(500).json({ message: "Error en el servidor.", error: err.message });
        }
        if (!user) {
            return res.status(404).json({ message: "El usuario no existe." });
        }

        // Comparar la contraseña enviada con el hash guardado en la BBDD
        const passwordIsValid = bcrypt.compareSync(password, user.password_hash);

        if (!passwordIsValid) {
            return res.status(401).json({ message: "Contraseña incorrecta." });
        }

        // Si la contraseña es válida, crear y firmar un token JWT
        const token = jwt.sign(
            { id: user.id, username: user.username }, // Payload del token
            process.env.JWT_SECRET,                            // Clave secreta
            { expiresIn: '24h' }                     // El token expirará en 24 horas
        );

        res.status(200).json({
            message: "Inicio de sesión exitoso.",
            token: token,
            user: {
                id: user.id,
                username: user.username,
                coins: user.coins
            }
        });
    });
};

module.exports = { register, login };