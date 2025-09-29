// routes/rewardRoutes.js
const express = require('express');
const router = express.Router();
const { getDailyRouletteStatus, spinDailyRoulette } = require('../controllers/rewardController');
const { verifyToken } = require('../middleware/authMiddleware');

// NUEVAS rutas para la Ruleta Diaria de Recompensas
router.get('/daily-roulette/status', verifyToken, getDailyRouletteStatus);
router.post('/daily-roulette/spin', verifyToken, spinDailyRoulette);

module.exports = router;