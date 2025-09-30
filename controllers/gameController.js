// controllers/gameController.js
const { db } = require('../database/database.js');
const { createDeck, shuffleDeck, calculateScore } = require('./gameHelpers.js');

// --- Constantes y Helpers (sin cambios) ---
const HOUSE_EDGE_MULTIPLIER = 0.99;
const MIN_BET = 1;
const MEMORY_COLORS = ['green', 'red', 'yellow', 'blue'];
const getRandomColor = () => MEMORY_COLORS[Math.floor(Math.random() * MEMORY_COLORS.length)];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const PAYOUTS = { 'straight': 35, 'dozen': 2, 'column': 2, 'simple': 1 };

const calculateRouletteWinnings = (winningNumber, bets) => {
    let totalWinnings = 0;
    const info = {
        value: winningNumber,
        color: (winningNumber === 0) ? 'green' : RED_NUMBERS.has(winningNumber) ? 'red' : 'black',
        isEven: winningNumber !== 0 && winningNumber % 2 === 0,
        isLow: winningNumber >= 1 && winningNumber <= 18,
        dozen: (winningNumber > 0) ? Math.ceil(winningNumber / 12) : 0,
        column: (winningNumber > 0) ? (winningNumber % 3 === 0 ? 3 : winningNumber % 3) : 0
    };

    for (const betType in bets) {
        const amount = bets[betType];
        let win = false;
        let payoutRate = 0;

        if (!isNaN(betType) && parseInt(betType) === info.value) { win = true; payoutRate = PAYOUTS.straight; }
        else if (betType === 'red' && info.color === 'red') { win = true; payoutRate = PAYOUTS.simple; }
        else if (betType === 'black' && info.color === 'black') { win = true; payoutRate = PAYOUTS.simple; }
        else if (betType === 'even' && info.isEven) { win = true; payoutRate = PAYOUTS.simple; }
        else if (betType === 'odd' && !info.isEven && info.value !== 0) { win = true; payoutRate = PAYOUTS.simple; }
        else if (betType === 'low' && info.isLow) { win = true; payoutRate = PAYOUTS.simple; }
        else if (betType === 'high' && !info.isLow && info.value !== 0) { win = true; payoutRate = PAYOUTS.simple; }
        else if (betType === `dozen${info.dozen}`) { win = true; payoutRate = PAYOUTS.dozen; }
        else if (betType === `col${info.column}`) { win = true; payoutRate = PAYOUTS.column; }
        
        if (win) {
            totalWinnings += amount + (amount * payoutRate);
        }
    }
    return totalWinnings;
};


// --- DADOS (Refactorizada) ---
const rollDice = async (req, res) => {
    const { bet, mode, target } = req.body;
    const userId = req.user.id;

    if (typeof bet !== 'number' || bet < MIN_BET || typeof target !== 'number' || target < 1 || target > 99 || !['under', 'over'].includes(mode)) {
        return res.status(400).json({ message: "Parámetros de apuesta inválidos." });
    }

    try {
        const userResult = await db.query('SELECT coins FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });
        
        const user = userResult.rows[0];
        if (user.coins < bet) return res.status(402).json({ message: "No tienes suficientes monedas para realizar esa apuesta." });

        const rollResult = parseFloat((Math.random() * 100).toFixed(2));
        const isWin = (mode === 'under') ? rollResult < target : rollResult > (100 - target);

        let payout = 0;
        if (isWin) {
            const winChance = mode === 'under' ? target : 100 - (100 - target);
            const multiplier = (100 / winChance) * HOUSE_EDGE_MULTIPLIER;
            payout = Math.floor(bet * multiplier);
        }

        const newBalance = user.coins - bet + payout;
        await db.query('UPDATE users SET coins = $1 WHERE id = $2', [newBalance, userId]);
        
        const netPayout = payout - bet;
        await db.query('INSERT INTO game_history (user_id, game_type, bet_details, result, payout) VALUES ($1, $2, $3, $4, $5)', 
            [userId, 'dice', JSON.stringify({ bet, mode, target }), JSON.stringify({ rollResult }), netPayout]);

        res.status(200).json({
            message: isWin ? "¡Ganaste!" : "¡Perdiste!",
            rollResult, isWin, payout, newBalance
        });
    } catch (err) {
        console.error("Error en rollDice:", err);
        res.status(500).json({ message: "Error en el servidor al jugar a los dados." });
    }
};

// --- BLACKJACK: REPARTIR (Refactorizada) ---
const dealBlackjack = async (req, res) => {
    const { bet } = req.body;
    const userId = req.user.id;

    if (typeof bet !== 'number' || bet <= 0) return res.status(400).json({ message: "Apuesta inválida." });

    try {
        const userResult = await db.query('SELECT coins FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });
        
        const user = userResult.rows[0];
        if (user.coins < bet) return res.status(402).json({ message: "Fondos insuficientes." });
        
        const newBalance = user.coins - bet;
        await db.query('UPDATE users SET coins = $1 WHERE id = $2', [newBalance, userId]);

        let deck = shuffleDeck(createDeck());
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];
        
        const sqlInsert = `INSERT INTO active_blackjack_games (user_id, deck, player_hand, dealer_hand, bet_amount) VALUES ($1, $2, $3, $4, $5) RETURNING id`;
        const gameResult = await db.query(sqlInsert, [userId, JSON.stringify(deck), JSON.stringify(playerHand), JSON.stringify(dealerHand), bet]);

        res.status(201).json({
            message: "Partida iniciada.",
            gameId: gameResult.rows[0].id,
            playerHand,
            dealerHand: [dealerHand[0], { rank: '?', suit: '?' }],
            playerScore: calculateScore(playerHand),
            newBalance
        });
    } catch (err) {
        console.error("Error en dealBlackjack:", err);
        res.status(500).json({ message: "Error en el servidor al iniciar partida de blackjack." });
    }
};

// --- BLACKJACK: PEDIR CARTA (Refactorizada) ---
const hitBlackjack = async (req, res) => {
    const { gameId } = req.body;
    const userId = req.user.id;

    try {
        const gameResult = await db.query('SELECT * FROM active_blackjack_games WHERE id = $1 AND user_id = $2', [gameId, userId]);
        if (gameResult.rows.length === 0) return res.status(404).json({ message: "Partida no encontrada." });
        
        const game = gameResult.rows[0];
        if (game.game_state !== 'player_turn') return res.status(400).json({ message: "No es tu turno." });

        let deck = JSON.parse(game.deck);
        let playerHand = JSON.parse(game.player_hand);

        playerHand.push(deck.pop());
        const playerScore = calculateScore(playerHand);

        if (playerScore > 21) {
            await db.query('DELETE FROM active_blackjack_games WHERE id = $1', [gameId]);
            await db.query('INSERT INTO game_history (user_id, game_type, bet_details, result, payout) VALUES ($1, $2, $3, $4, $5)', 
                [userId, 'blackjack', JSON.stringify({ bet: game.bet_amount }), JSON.stringify({ outcome: 'loss_bust', playerScore, playerHand }), -game.bet_amount]);
            
            return res.status(200).json({ 
                message: "¡Te pasaste! Pierdes.", 
                gameState: "game_over",
                playerHand,
                playerScore 
            });
        }

        await db.query('UPDATE active_blackjack_games SET deck = $1, player_hand = $2 WHERE id = $3', 
            [JSON.stringify(deck), JSON.stringify(playerHand), gameId]);
        
        res.status(200).json({ message: "Carta recibida.", playerHand, playerScore });
    } catch (err) {
        console.error("Error en hitBlackjack:", err);
        res.status(500).json({ message: "Error en el servidor al pedir carta." });
    }
};

// --- BLACKJACK: PLANTARSE (Refactorizada) ---
const standBlackjack = async (req, res) => {
    const { gameId } = req.body;
    const userId = req.user.id;

    try {
        const gameResult = await db.query('SELECT * FROM active_blackjack_games WHERE id = $1 AND user_id = $2', [gameId, userId]);
        if (gameResult.rows.length === 0) return res.status(404).json({ message: "Partida no encontrada." });

        const game = gameResult.rows[0];
        let deck = JSON.parse(game.deck);
        let playerHand = JSON.parse(game.player_hand);
        let dealerHand = JSON.parse(game.dealer_hand);
        const playerScore = calculateScore(playerHand);
        let dealerScore = calculateScore(dealerHand);

        while (dealerScore < 17) {
            dealerHand.push(deck.pop());
            dealerScore = calculateScore(dealerHand);
        }

        let resultMessage = "", payout = 0;
        if (playerScore > 21) { resultMessage = "Perdiste (te pasaste)."; } 
        else if (dealerScore > 21 || playerScore > dealerScore) { resultMessage = "¡Ganaste!"; payout = game.bet_amount * 2; } 
        else if (playerScore < dealerScore) { resultMessage = "El Dealer gana."; } 
        else { resultMessage = "¡Empate!"; payout = game.bet_amount; }
        
        const userResult = await db.query('SELECT coins FROM users WHERE id = $1', [userId]);
        const finalBalance = userResult.rows[0].coins + payout;
        await db.query('UPDATE users SET coins = $1 WHERE id = $2', [finalBalance, userId]);

        const netPayout = payout - game.bet_amount;
        await db.query('INSERT INTO game_history (user_id, game_type, bet_details, result, payout) VALUES ($1, $2, $3, $4, $5)', 
            [userId, 'blackjack', JSON.stringify({ bet: game.bet_amount }), JSON.stringify({ outcome: resultMessage, playerScore, dealerScore, playerHand, dealerHand }), netPayout]);

        await db.query('DELETE FROM active_blackjack_games WHERE id = $1', [gameId]);

        res.status(200).json({
            message: resultMessage, gameState: "game_over", playerHand, playerScore,
            dealerHand, dealerScore, newBalance: finalBalance
        });
    } catch (err) {
        console.error("Error en standBlackjack:", err);
        res.status(500).json({ message: "Error en el servidor al plantarse." });
    }
};

// --- LOTERÍA: COMPRAR BOLETO (Refactorizada) ---
const LOTTERY_TICKET_PRICE = 100;
const buyLotteryTicket = async (req, res) => {
    const { numbers } = req.body;
    const userId = req.user.id;
    
    if (!Array.isArray(numbers) || numbers.length !== 3 || new Set(numbers).size !== 3 || numbers.some(n => typeof n !== 'number' || n < 1 || n > 99)) {
        return res.status(400).json({ message: "Debes elegir 3 números únicos entre 1 y 99." });
    }
    
    try {
        const userResult = await db.query('SELECT coins FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });
        
        const user = userResult.rows[0];
        if (user.coins < LOTTERY_TICKET_PRICE) return res.status(402).json({ message: "Fondos insuficientes." });

        const today = new Date().toISOString().split('T')[0];
        const ticketResult = await db.query('SELECT id FROM lottery_tickets WHERE user_id = $1 AND draw_date = $2', [userId, today]);
        
        if (ticketResult.rows.length > 0) return res.status(409).json({ message: "Ya has comprado un boleto para el sorteo de hoy." });
        
        const newBalance = user.coins - LOTTERY_TICKET_PRICE;
        await db.query('UPDATE users SET coins = $1 WHERE id = $2', [newBalance, userId]);
        await db.query('INSERT INTO lottery_tickets (user_id, draw_date, chosen_numbers) VALUES ($1, $2, $3)', 
            [userId, today, JSON.stringify(numbers)]);

        res.status(201).json({ message: "Boleto comprado con éxito.", yourNumbers: numbers, newBalance });
    } catch (err) {
        console.error("Error en buyLotteryTicket:", err);
        res.status(500).json({ message: "Error en el servidor al comprar el boleto." });
    }
};

// --- LOTERÍA: OBTENER INFO (Refactorizada) ---
const getLotteryInfo = async (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
        const responseData = { yesterdaysDraw: null, userTicketForToday: null };
        const drawResult = await db.query('SELECT winning_numbers FROM lottery_draws WHERE draw_date = $1', [yesterdayStr]);
        
        if (drawResult.rows.length > 0) {
            responseData.yesterdaysDraw = JSON.parse(drawResult.rows[0].winning_numbers);
        }
        
        const ticketResult = await db.query('SELECT chosen_numbers FROM lottery_tickets WHERE user_id = $1 AND draw_date = $2', [userId, today]);
        
        if (ticketResult.rows.length > 0) {
            responseData.userTicketForToday = JSON.parse(ticketResult.rows[0].chosen_numbers);
        }
        
        res.status(200).json(responseData);
    } catch (err) {
        console.error("Error en getLotteryInfo:", err);
        res.status(500).json({ message: "Error en el servidor al obtener info de la lotería." });
    }
};

// --- MEMORIA: INICIAR PARTIDA (Refactorizada) ---
const startMemoryGame = async (req, res) => {
    const { bet } = req.body;
    const userId = req.user.id;

    if (typeof bet !== 'number' || bet <= 0) return res.status(400).json({ message: "Apuesta inválida." });

    try {
        const userResult = await db.query('SELECT coins FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });

        const user = userResult.rows[0];
        if (user.coins < bet) return res.status(402).json({ message: "Fondos insuficientes." });
        
        const newBalance = user.coins - bet;
        await db.query('UPDATE users SET coins = $1 WHERE id = $2', [newBalance, userId]);

        const firstSequence = [getRandomColor()];
        const sqlInsert = `INSERT INTO active_memory_games (user_id, bet_amount, current_sequence, current_level) VALUES ($1, $2, $3, $4) RETURNING id`;
        const gameResult = await db.query(sqlInsert, [userId, bet, JSON.stringify(firstSequence), 1]);
            
        res.status(201).json({
            message: "Partida de memoria iniciada.",
            gameId: gameResult.rows[0].id,
            nextSequence: firstSequence,
            level: 1,
            newBalance
        });
    } catch (err) {
        console.error("Error en startMemoryGame:", err);
        res.status(500).json({ message: "Error en el servidor al iniciar juego de memoria." });
    }
};

// --- MEMORIA: ADIVINAR SECUENCIA (Refactorizada) ---
const guessMemorySequence = async (req, res) => {
    const { gameId, playerSequence } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(playerSequence)) return res.status(400).json({ message: "La secuencia enviada no es válida." });

    try {
        const gameResult = await db.query('SELECT * FROM active_memory_games WHERE id = $1 AND user_id = $2', [gameId, userId]);
        if (gameResult.rows.length === 0) return res.status(404).json({ message: "Partida no encontrada." });

        const game = gameResult.rows[0];
        const correctSequence = JSON.parse(game.current_sequence);

        if (playerSequence.length !== correctSequence.length || !playerSequence.every((val, i) => val === correctSequence[i])) {
            await db.query('DELETE FROM active_memory_games WHERE id = $1', [gameId]);
            return res.status(200).json({
                result: "incorrect",
                message: "¡Secuencia incorrecta! Perdiste tu apuesta.",
                gameState: "game_over"
            });
        }

        const nextLevel = game.current_level + 1;
        const nextSequence = [...correctSequence, getRandomColor()];
        await db.query('UPDATE active_memory_games SET current_sequence = $1, current_level = $2 WHERE id = $3', 
            [JSON.stringify(nextSequence), nextLevel, gameId]);

        res.status(200).json({
            result: "correct",
            message: `¡Nivel ${game.current_level} superado!`,
            nextSequence,
            level: nextLevel
        });
    } catch (err) {
        console.error("Error en guessMemorySequence:", err);
        res.status(500).json({ message: "Error en el servidor al adivinar la secuencia." });
    }
};

// --- MEMORIA: COBRAR GANANCIAS (Refactorizada) ---
const cashoutMemoryGame = async (req, res) => {
    const { gameId } = req.body;
    const userId = req.user.id;

    try {
        const gameResult = await db.query('SELECT * FROM active_memory_games WHERE id = $1 AND user_id = $2', [gameId, userId]);
        if (gameResult.rows.length === 0) return res.status(404).json({ message: "Partida no encontrada." });

        const game = gameResult.rows[0];
        const completedLevels = game.current_level - 1;
        let payout = (completedLevels > 0) 
            ? Math.floor(game.bet_amount * parseFloat(Math.pow(1.35, completedLevels).toFixed(2)))
            : game.bet_amount;

        const userResult = await db.query('SELECT coins FROM users WHERE id = $1', [userId]);
        const finalBalance = userResult.rows[0].coins + payout;
        
        await db.query('UPDATE users SET coins = $1 WHERE id = $2', [finalBalance, userId]);
        await db.query('DELETE FROM active_memory_games WHERE id = $1', [gameId]);

        res.status(200).json({
            message: `¡Retirada exitosa! Ganaste ${payout} monedas.`,
            payout,
            newBalance: finalBalance,
            gameState: "game_over"
        });
    } catch (err) {
        console.error("Error en cashoutMemoryGame:", err);
        res.status(500).json({ message: "Error en el servidor al retirar ganancias." });
    }
};

// --- RULETA DE CASINO: GIRAR (Refactorizada) ---
const spinCasinoRoulette = async (req, res) => {
    const { bets } = req.body;
    const userId = req.user.id;

    if (typeof bets !== 'object' || Object.keys(bets).length === 0) {
        return res.status(400).json({ message: "No se han proporcionado apuestas válidas." });
    }
    const totalBet = Object.values(bets).reduce((sum, amount) => sum + (typeof amount === 'number' ? amount : 0), 0);
    if (totalBet <= 0) return res.status(400).json({ message: "La apuesta total debe ser mayor que cero." });

    try {
        const userResult = await db.query('SELECT coins FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });
        
        const user = userResult.rows[0];
        if (user.coins < totalBet) return res.status(402).json({ message: "Fondos insuficientes." });

        const winningNumber = Math.floor(Math.random() * 37);
        const payout = calculateRouletteWinnings(winningNumber, bets);
        const newBalance = user.coins - totalBet + payout;

        await db.query('UPDATE users SET coins = $1 WHERE id = $2', [newBalance, userId]);

        const netPayout = payout - totalBet;
        await db.query('INSERT INTO game_history (user_id, game_type, bet_details, result, payout) VALUES ($1, $2, $3, $4, $5)', 
            [userId, 'roulette', JSON.stringify(bets), JSON.stringify({ winningNumber }), netPayout]);

        res.status(200).json({ winningNumber, payout, newBalance });
    } catch (err) {
        console.error("Error en spinCasinoRoulette:", err);
        res.status(500).json({ message: "Error en el servidor al girar la ruleta." });
    }
};

// --- OBTENER HISTORIAL DE JUEGOS (Refactorizada) ---
const getGameHistory = async (req, res) => {
    const { gameType } = req.params;
    const validGameTypes = ['dice', 'roulette', 'blackjack'];

    if (!validGameTypes.includes(gameType)) return res.status(400).json({ message: "Tipo de juego no válido." });

    try {
        const sql = `SELECT result, created_at FROM game_history WHERE game_type = $1 ORDER BY created_at DESC LIMIT 15`;
        const result = await db.query(sql, [gameType]);
        
        const history = result.rows.map(row => ({
            ...JSON.parse(row.result),
            timestamp: row.created_at
        }));
        
        res.status(200).json(history);
    } catch (err) {
        console.error("Error en getGameHistory:", err);
        res.status(500).json({ message: "Error al obtener el historial del juego." });
    }
};


module.exports = {
    rollDice,
    dealBlackjack,
    hitBlackjack,
    standBlackjack,
    buyLotteryTicket,
    getLotteryInfo,
    startMemoryGame,
    guessMemorySequence,
    cashoutMemoryGame,
    spinCasinoRoulette,
    getGameHistory
};