// routes/userRoutes.js
const express = require('express');
const router = express.Router();
// Importar la nueva función
const { getProfile, updateProfile } = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

// Ruta existente
router.get('/profile', verifyToken, getProfile);

// NUEVA ruta para actualizar el perfil. Usamos PUT, que es el verbo HTTP para actualizar.
router.put('/profile', verifyToken, updateProfile);

module.exports = router;