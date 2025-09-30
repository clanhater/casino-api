// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/database.js');

// --- FUNCIÓN DE REGISTRO (Refactorizada para PostgreSQL) ---
const register = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "El nombre de usuario y la contraseña son obligatorios." });
    }

    try {
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);

        // Usamos $1 y $2 para los parámetros en PostgreSQL
        const sql = 'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id';
        const params = [username, password_hash];

        const result = await db.query(sql, params);
        
        res.status(201).json({ message: "Usuario registrado con éxito.", userId: result.rows[0].id });

    } catch (err) {
        // El código de error para violación de unicidad en PostgreSQL es '23505'
        if (err.code === '23505') {
            return res.status(409).json({ message: "El nombre de usuario ya existe." });
        }
        console.error(err);
        return res.status(500).json({ message: "Error al registrar el usuario.", error: err.message });
    }
};

// --- FUNCIÓN DE LOGIN (Refactorizada para PostgreSQL) ---
const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "El nombre de usuario y la contraseña son obligatorios." });
    }

    try {
        const sql = 'SELECT * FROM users WHERE username = $1';
        const result = await db.query(sql, [username]);

        // 'result.rows' es un array. Si está vacío, el usuario no existe.
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "El usuario no existe." });
        }

        const user = result.rows[0]; // El usuario encontrado

        const passwordIsValid = bcrypt.compareSync(password, user.password_hash);

        if (!passwordIsValid) {
            return res.status(401).json({ message: "Contraseña incorrecta." });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
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

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error en el servidor.", error: err.message });
    }
};

module.exports = { register, login };