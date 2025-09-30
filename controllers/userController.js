// controllers/userController.js
const { db } = require('../database/database.js');
const jwt = require('jsonwebtoken');

// --- OBTENER PERFIL (Refactorizada para PostgreSQL) ---
const getProfile = async (req, res) => {
    const userId = req.user.id;
    try {
        const sql = 'SELECT id, username, coins, profile_pic_base64, created_at FROM users WHERE id = $1';
        const result = await db.query(sql, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error("Error en getProfile:", err);
        res.status(500).json({ message: "Error en el servidor al obtener el perfil." });
    }
};

// --- ACTUALIZAR PERFIL (Refactorizada para PostgreSQL) ---
const updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { newUsername, profilePic } = req.body;

    if (!newUsername && !profilePic) {
        return res.status(400).json({ message: "No se proporcionaron datos para actualizar." });
    }

    try {
        // 1. Validar el nuevo nombre de usuario si se proporciona
        if (newUsername) {
            if (newUsername.length < 3) {
                return res.status(400).json({ message: "El nombre de usuario debe tener al menos 3 caracteres." });
            }
            // Comprobar si el nombre ya está en uso por OTRO usuario
            const sqlCheck = 'SELECT id FROM users WHERE username = $1 AND id != $2';
            const result = await db.query(sqlCheck, [newUsername, userId]);

            if (result.rows.length > 0) {
                return res.status(409).json({ message: "Ese nombre de usuario ya está en uso." });
            }
        }

        // 2. Construir la consulta de actualización dinámicamente
        let updates = [];
        let params = [];
        let paramIndex = 1;

        if (newUsername) {
            updates.push(`username = $${paramIndex++}`);
            params.push(newUsername);
        }
        if (profilePic) {
            updates.push(`profile_pic_base64 = $${paramIndex++}`);
            params.push(profilePic);
        }
        
        // El último parámetro siempre será el userId para la cláusula WHERE
        params.push(userId);
        
        const sqlUpdate = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING username`;

        // 3. Ejecutar la consulta de actualización
        const updateResult = await db.query(sqlUpdate, params);

        // 4. Si el nombre de usuario cambió, emitir un nuevo token
        // Gracias a 'RETURNING username', sabemos cuál es el nombre de usuario final.
        const finalUsername = updateResult.rows[0].username;
        if (newUsername && newUsername === finalUsername) {
            const newToken = jwt.sign(
                { id: userId, username: finalUsername },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            return res.status(200).json({ message: "Perfil actualizado con éxito.", newToken });
        }
        
        // Si solo la foto cambió, o si no se cambió el nombre, no se necesita nuevo token.
        res.status(200).json({ message: "Perfil actualizado con éxito." });

    } catch (err) {
        // Manejar errores de unicidad si ocurren en la actualización (aunque ya lo validamos)
        if (err.code === '23505') {
            return res.status(409).json({ message: "Ese nombre de usuario ya está en uso." });
        }
        console.error("Error en updateProfile:", err);
        res.status(500).json({ message: "Error en el servidor al actualizar el perfil." });
    }
};

module.exports = { getProfile, updateProfile };