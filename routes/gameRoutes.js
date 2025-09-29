// routes/gameRoutes.js
const express = require('express');
const router = express.Router();
// Añadir las nuevas funciones del controlador
const { rollDice, dealBlackjack, hitBlackjack, standBlackjack, buyLotteryTicket, getLotteryInfo, startMemoryGame, guessMemorySequence, cashoutMemoryGame, spinCasinoRoulette, getGameHistory} = require('../controllers/gameController');
const { verifyToken } = require('../middleware/authMiddleware');

// Ruta de Dados (existente)
router.post('/dice/roll', verifyToken, rollDice);

// NUEVAS rutas de Blackjack
router.post('/blackjack/deal', verifyToken, dealBlackjack);
router.post('/blackjack/hit', verifyToken, hitBlackjack);
router.post('/blackjack/stand', verifyToken, standBlackjack);

// NUEVA ruta de lotería
router.post('/lottery/buy', verifyToken, buyLotteryTicket);
router.get('/lottery/info', verifyToken, getLotteryInfo);

// NUEVAS rutas para el Juego de Memoria
router.post('/memory/start', verifyToken, startMemoryGame);
router.post('/memory/guess', verifyToken, guessMemorySequence);
router.post('/memory/cashout', verifyToken, cashoutMemoryGame);

// NUEVA ruta para la Ruleta de Casino
router.post('/casino-roulette/spin', verifyToken, spinCasinoRoulette);

// NUEVA ruta para obtener el historial de cualquier juego
router.get('/:gameType/history', verifyToken, getGameHistory);

module.exports = router;