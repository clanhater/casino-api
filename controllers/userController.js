// controllers/userController.js
const { db } = require('../database/database.js');
const jwt = require('jsonwebtoken'); // <-- Necesitamos JWT para re-firmar el token

const getProfile = (req, res) => {
    const userId = req.user.id;
    // Modificamos la consulta para incluir la nueva columna
    const sql = 'SELECT id, username, coins, profile_pic_base64, created_at FROM users WHERE id = ?';
    db.get(sql, [userId], (err, user) => {
        if (err) return res.status(500).json({ message: "Error en el servidor.", error: err.message });
        if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
        res.status(200).json(user);
    });
};

// NUEVA FUNCIÓN para actualizar el perfil
const updateProfile = (req, res) => {
    const userId = req.user.id;
    const { newUsername, profilePic } = req.body;

    if (!newUsername && !profilePic) {
        return res.status(400).json({ message: "No se proporcionaron datos para actualizar." });
    }

    // 1. Validar el nuevo nombre de usuario si se proporciona
    if (newUsername) {
        if (newUsername.length < 3) {
            return res.status(400).json({ message: "El nombre de usuario debe tener al menos 3 caracteres." });
        }
        // Comprobar si el nombre ya está en uso por OTRO usuario
        const sqlCheck = 'SELECT id FROM users WHERE username = ? AND id != ?';
        db.get(sqlCheck, [newUsername, userId], (err, user) => {
            if (user) {
                return res.status(409).json({ message: "Ese nombre de usuario ya está en uso." });
            }
            // Si el nombre es válido y/o se proporciona una imagen, proceder a actualizar
            performUpdate(userId, newUsername, profilePic, res);
        });
    } else {
        // Si solo se cambia la imagen, proceder directamente
        performUpdate(userId, null, profilePic, res);
    }
};

// Función auxiliar para realizar la actualización en la BBDD
const performUpdate = (userId, newUsername, profilePic, res) => {
    let updates = [];
    let params = [];
    
    if (newUsername) {
        updates.push("username = ?");
        params.push(newUsername);
    }
    if (profilePic) {
        updates.push("profile_pic_base64 = ?");
        params.push(profilePic);
    }

    if (updates.length === 0) return; // Seguridad extra
    
    const sqlUpdate = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    params.push(userId);
    
    db.run(sqlUpdate, params, function(err) {
        if (err) return res.status(500).json({ message: "Error al actualizar el perfil." });
        
        // Si el nombre de usuario cambió, debemos emitir un nuevo token
        if (newUsername) {
            const newToken = jwt.sign(
                { id: userId, username: newUsername },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            return res.status(200).json({ message: "Perfil actualizado con éxito.", newToken });
        }
        
        res.status(200).json({ message: "Perfil actualizado con éxito." });
    });
};

module.exports = { getProfile, updateProfile };