// controllers/gameController.js
const { db } = require('../database/database.js');
const { createDeck, shuffleDeck, calculateScore } = require('./gameHelpers.js');

// Constantes del juego para un fácil ajuste
const HOUSE_EDGE_MULTIPLIER = 0.99; // Ventaja para la casa del 1%. Un 1.00 sería 0%.
const MIN_BET = 1;

// --- CONSTANTES DEL JUEGO DE MEMORIA ---
const MEMORY_COLORS = ['green', 'red', 'yellow', 'blue'];

// Función auxiliar para generar un color aleatorio
const getRandomColor = () => MEMORY_COLORS[Math.floor(Math.random() * MEMORY_COLORS.length)];

// --- CONSTANTES Y HELPERS PARA LA RULETA DE CASINO ---
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const PAYOUTS = { 'straight': 35, 'dozen': 2, 'column': 2, 'simple': 1 };

// Función auxiliar para calcular las ganancias totales de una tirada
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


const rollDice = (req, res) => {
    // 1. OBTENER DATOS Y VALIDAR ENTRADA
    const { bet, mode, target } = req.body;
    const userId = req.user.id; // Obtenido del token JWT verificado por el middleware

    if (typeof bet !== 'number' || bet < MIN_BET) {
        return res.status(400).json({ message: `La apuesta debe ser un número y como mínimo ${MIN_BET}.` });
    }
    if (mode !== 'under' && mode !== 'over') {
        return res.status(400).json({ message: "El modo debe ser 'under' o 'over'." });
    }
    if (typeof target !== 'number' || target < 1 || target > 99) {
        return res.status(400).json({ message: "El objetivo debe ser un número entre 1 y 99." });
    }

    // 2. VERIFICAR EL SALDO DEL JUGADOR
    const sqlGetUser = 'SELECT coins FROM users WHERE id = ?';
    db.get(sqlGetUser, [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ message: "Error al consultar los datos del usuario.", error: err.message });
        }
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }
        if (user.coins < bet) {
            return res.status(402).json({ message: "No tienes suficientes monedas para realizar esa apuesta." });
        }

        // 3. EJECUTAR LA LÓGICA DEL JUEGO
        const initialBalance = user.coins;
        const newBalanceAfterBet = initialBalance - bet;

        // Generamos el resultado en el servidor para que no pueda ser manipulado
        const rollResult = parseFloat((Math.random() * 100).toFixed(2));
        
        let isWin = false;
        if (mode === 'under') {
            isWin = rollResult < target;
        } else { // mode === 'over'
            const overTarget = 100 - target;
            isWin = rollResult > overTarget;
        }

        let finalBalance = newBalanceAfterBet;
        let payout = 0;

        if (isWin) {
            const winChance = mode === 'under' ? target : 100 - (100 - target);
            const multiplier = (100 / winChance) * HOUSE_EDGE_MULTIPLIER;
            payout = Math.floor(bet * multiplier); // Usamos Math.floor para evitar decimales en las monedas
            finalBalance += payout;
        }

        // 4. ACTUALIZAR LA BASE DE DATOS DE FORMA SEGURA
        const sqlUpdateBalance = 'UPDATE users SET coins = ? WHERE id = ?';
        db.run(sqlUpdateBalance, [finalBalance, userId], function(err) {
            if (err) {
                return res.status(500).json({ message: "Error crítico: no se pudo actualizar tu saldo.", error: err.message });
            }
			
			// NUEVO: 5. Registrar la jugada en el historial
            const betDetailsJSON = JSON.stringify({ bet, mode, target });
            const resultJSON = JSON.stringify({ rollResult });
            const sqlHistory = `INSERT INTO game_history (user_id, game_type, bet_details, result, payout) VALUES (?, ?, ?, ?, ?)`;
            // El 'payout' en este caso es el beneficio neto, no el retorno total.
            // Si gana, el payout es (totalReturn - betAmount). Si pierde, es 0.
            const netPayout = isWin ? payout - bet : 0; 
            db.run(sqlHistory, [userId, 'dice', betDetailsJSON, resultJSON, netPayout]);

            // 6. DEVOLVER EL RESULTADO AL CLIENTE
            res.status(200).json({
                message: isWin ? "¡Ganaste!" : "¡Perdiste!",
                rollResult: rollResult,
                isWin: isWin,
                payout: payout,
                newBalance: finalBalance
            });
        });
    });
};

// --- BLACKJACK: REPARTIR (INICIAR PARTIDA) ---
const dealBlackjack = (req, res) => {
    const { bet } = req.body;
    const userId = req.user.id;

    if (typeof bet !== 'number' || bet <= 0) {
        return res.status(400).json({ message: "Apuesta inválida." });
    }

    db.get('SELECT coins FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ message: "Error al obtener datos del usuario." });
        if (user.coins < bet) return res.status(402).json({ message: "Fondos insuficientes." });

        // Descontar la apuesta INMEDIATAMENTE
        const newBalance = user.coins - bet;
        db.run('UPDATE users SET coins = ? WHERE id = ?', [newBalance, userId]);

        // Crear y barajar la baraja
        let deck = shuffleDeck(createDeck());
        
        // Repartir cartas
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];
        
        // Guardar la partida en la BBDD
        const sqlInsertGame = `INSERT INTO active_blackjack_games 
            (user_id, deck, player_hand, dealer_hand, bet_amount) 
            VALUES (?, ?, ?, ?, ?)`;
        
        // Guardamos los arrays como strings JSON en SQLite
        const params = [
            userId, 
            JSON.stringify(deck),
            JSON.stringify(playerHand),
            JSON.stringify(dealerHand),
            bet
        ];

        db.run(sqlInsertGame, params, function(err) {
            if (err) return res.status(500).json({ message: "Error al iniciar la partida." });
            
            res.status(201).json({
                message: "Partida iniciada.",
                gameId: this.lastID,
                playerHand,
                dealerHand: [dealerHand[0], { rank: '?', suit: '?' }], // Mostrar solo una carta del dealer
                playerScore: calculateScore(playerHand),
                newBalance
            });
        });
    });
};

// --- BLACKJACK: PEDIR CARTA ---
const hitBlackjack = (req, res) => {
    const { gameId } = req.body;
    const userId = req.user.id;

    const sqlGetGame = 'SELECT * FROM active_blackjack_games WHERE id = ? AND user_id = ?';
    db.get(sqlGetGame, [gameId, userId], (err, game) => {
        if (err || !game) return res.status(404).json({ message: "Partida no encontrada o no pertenece al usuario." });
        if (game.game_state !== 'player_turn') return res.status(400).json({ message: "No es tu turno." });

        let deck = JSON.parse(game.deck);
        let playerHand = JSON.parse(game.player_hand);

        playerHand.push(deck.pop());
        const playerScore = calculateScore(playerHand);

        // Si el jugador se pasa de 21, la partida termina
        if (playerScore > 21) {
			const betDetailsJSON = JSON.stringify({ bet: game.bet_amount });
			const resultJSON = JSON.stringify({ outcome: 'loss_bust', playerScore, playerHand: JSON.parse(game.player_hand) });
			db.run('INSERT INTO game_history (user_id, game_type, bet_details, result, payout) VALUES (?, ?, ?, ?, ?)',
				[userId, 'blackjack', betDetailsJSON, resultJSON, -game.bet_amount]); // Payout negativo indica la pérdida de la apuesta
				
            db.run('DELETE FROM active_blackjack_games WHERE id = ?', [gameId]); // Limpiar la partida
            return res.status(200).json({ 
                message: "¡Te pasaste! Pierdes.", 
                gameState: "game_over",
                playerHand,
                playerScore 
            });
        }

        // Actualizar la partida en la BBDD
        const sqlUpdate = 'UPDATE active_blackjack_games SET deck = ?, player_hand = ? WHERE id = ?';
        db.run(sqlUpdate, [JSON.stringify(deck), JSON.stringify(playerHand), gameId]);
        
        res.status(200).json({
            message: "Carta recibida.",
            playerHand,
            playerScore
        });
    });
};


// --- BLACKJACK: PLANTARSE ---
const standBlackjack = (req, res) => {
    const { gameId } = req.body;
    const userId = req.user.id;

    const sqlGetGame = 'SELECT * FROM active_blackjack_games WHERE id = ? AND user_id = ?';
    db.get(sqlGetGame, [gameId, userId], (err, game) => {
        if (err || !game) return res.status(404).json({ message: "Partida no encontrada." });

        let deck = JSON.parse(game.deck);
        let playerHand = JSON.parse(game.player_hand);
        let dealerHand = JSON.parse(game.dealer_hand);
        
        const playerScore = calculateScore(playerHand);
        let dealerScore = calculateScore(dealerHand);

        // Turno del Dealer: pide cartas hasta llegar a 17 o más
        while (dealerScore < 17) {
            dealerHand.push(deck.pop());
            dealerScore = calculateScore(dealerHand);
        }

        // Determinar el resultado
        let resultMessage = "";
        let payout = 0; // 'payout' aquí es el retorno total (apuesta + ganancia)
        if (playerScore > 21) {
            resultMessage = "Perdiste (te pasaste).";
        } else if (dealerScore > 21 || playerScore > dealerScore) {
            resultMessage = "¡Ganaste!";
            payout = game.bet_amount * 2;
        } else if (playerScore < dealerScore) {
            resultMessage = "El Dealer gana.";
        } else {
            resultMessage = "¡Empate!";
            payout = game.bet_amount; // Devolver la apuesta original
        }
        
        // Actualizar el saldo del usuario con las ganancias
        db.get('SELECT coins FROM users WHERE id = ?', [userId], (err, user) => {
            if (err || !user) return res.status(500).json({ message: "Error al recuperar datos del usuario para el pago." });
            
            const finalBalance = user.coins + payout;
            db.run('UPDATE users SET coins = ? WHERE id = ?', [finalBalance, userId]);

            // NUEVO: Guardar el resultado en el historial ANTES de enviar la respuesta
            const betDetailsJSON = JSON.stringify({ bet: game.bet_amount });
            const resultJSON = JSON.stringify({ outcome: resultMessage, playerScore, dealerScore, playerHand, dealerHand });
            // El 'netPayout' es la ganancia o pérdida neta (lo que se suma o resta a la apuesta inicial)
            const netPayout = payout - game.bet_amount;
            const sqlHistory = `INSERT INTO game_history (user_id, game_type, bet_details, result, payout) VALUES (?, ?, ?, ?, ?)`;
            db.run(sqlHistory, [userId, 'blackjack', betDetailsJSON, resultJSON, netPayout]);

            // Limpiar la partida de la tabla de juegos activos
            db.run('DELETE FROM active_blackjack_games WHERE id = ?', [gameId]);

            // Enviar la respuesta final al cliente
            res.status(200).json({
                message: resultMessage,
                gameState: "game_over",
                playerHand,
                playerScore,
                dealerHand,
                dealerScore,
                newBalance: finalBalance
            });
        });
    });
};

// --- LOTERÍA: COMPRAR BOLETO ---
const LOTTERY_TICKET_PRICE = 100;
const buyLotteryTicket = (req, res) => {
    const { numbers } = req.body;
    const userId = req.user.id;
    
    // Validar entrada
    if (!Array.isArray(numbers) || numbers.length !== 3 || new Set(numbers).size !== 3) {
        return res.status(400).json({ message: "Debes elegir 3 números únicos." });
    }
    for (const num of numbers) {
        if (typeof num !== 'number' || num < 1 || num > 99) {
            return res.status(400).json({ message: "Los números deben estar entre 1 y 99." });
        }
    }
    
    db.get('SELECT coins FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ message: "Error del usuario." });
        if (user.coins < LOTTERY_TICKET_PRICE) return res.status(402).json({ message: "Fondos insuficientes." });

        const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD

        // Verificar si ya compró un boleto hoy
        db.get('SELECT id FROM lottery_tickets WHERE user_id = ? AND draw_date = ?', [userId, today], (err, ticket) => {
            if (ticket) return res.status(409).json({ message: "Ya has comprado un boleto para el sorteo de hoy." });
            
            const newBalance = user.coins - LOTTERY_TICKET_PRICE;
            db.run('UPDATE users SET coins = ? WHERE id = ?', [newBalance, userId]);
            db.run('INSERT INTO lottery_tickets (user_id, draw_date, chosen_numbers) VALUES (?, ?, ?)',
                [userId, today, JSON.stringify(numbers)],
                (err) => {
                    if (err) return res.status(500).json({ message: "Error al comprar el boleto." });
                    res.status(201).json({ message: "Boleto comprado con éxito.", yourNumbers: numbers, newBalance });
                }
            );
        });
    });
};

const getLotteryInfo = (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const responseData = {
        yesterdaysDraw: null,
        userTicketForToday: null
    };

    db.get('SELECT winning_numbers FROM lottery_draws WHERE draw_date = ?', [yesterdayStr], (err, draw) => {
        if (draw) {
            responseData.yesterdaysDraw = JSON.parse(draw.winning_numbers);
        }
        db.get('SELECT chosen_numbers FROM lottery_tickets WHERE user_id = ? AND draw_date = ?', [userId, today], (err, ticket) => {
            if (ticket) {
                responseData.userTicketForToday = JSON.parse(ticket.chosen_numbers);
            }
            res.status(200).json(responseData);
        });
    });
};

// --- MEMORIA: INICIAR PARTIDA ---
const startMemoryGame = (req, res) => {
    const { bet } = req.body;
    const userId = req.user.id;

    if (typeof bet !== 'number' || bet <= 0) {
        return res.status(400).json({ message: "Apuesta inválida." });
    }

    db.get('SELECT coins FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ message: "Error al obtener datos del usuario." });
        if (user.coins < bet) return res.status(402).json({ message: "Fondos insuficientes." });

        const newBalance = user.coins - bet;
        db.run('UPDATE users SET coins = ? WHERE id = ?', [newBalance, userId]);

        const firstSequence = [getRandomColor()];
        
        const sqlInsertGame = `INSERT INTO active_memory_games 
            (user_id, bet_amount, current_sequence, current_level) 
            VALUES (?, ?, ?, ?)`;
        
        db.run(sqlInsertGame, [userId, bet, JSON.stringify(firstSequence), 1], function(err) {
            if (err) return res.status(500).json({ message: "Error al iniciar la partida." });
            
            res.status(201).json({
                message: "Partida de memoria iniciada.",
                gameId: this.lastID,
                nextSequence: firstSequence,
                level: 1,
                newBalance
            });
        });
    });
};

// --- MEMORIA: ADIVINAR SECUENCIA ---
const guessMemorySequence = (req, res) => {
    const { gameId, playerSequence } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(playerSequence)) {
        return res.status(400).json({ message: "La secuencia enviada no es válida." });
    }

    const sqlGetGame = 'SELECT * FROM active_memory_games WHERE id = ? AND user_id = ?';
    db.get(sqlGetGame, [gameId, userId], (err, game) => {
        if (err || !game) return res.status(404).json({ message: "Partida no encontrada." });

        const correctSequence = JSON.parse(game.current_sequence);

        // Validar si la secuencia del jugador es correcta
        if (playerSequence.length !== correctSequence.length || !playerSequence.every((val, i) => val === correctSequence[i])) {
            // Incorrecto: el jugador pierde la apuesta, se elimina la partida
            db.run('DELETE FROM active_memory_games WHERE id = ?', [gameId]);
            return res.status(200).json({
                result: "incorrect",
                message: "¡Secuencia incorrecta! Perdiste tu apuesta.",
                gameState: "game_over"
            });
        }

        // Correcto: generar el siguiente nivel
        const nextLevel = game.current_level + 1;
        const nextSequence = [...correctSequence, getRandomColor()];

        const sqlUpdate = 'UPDATE active_memory_games SET current_sequence = ?, current_level = ? WHERE id = ?';
        db.run(sqlUpdate, [JSON.stringify(nextSequence), nextLevel, gameId]);

        res.status(200).json({
            result: "correct",
            message: `¡Nivel ${game.current_level} superado!`,
            nextSequence: nextSequence,
            level: nextLevel
        });
    });
};

// --- MEMORIA: COBRAR GANANCIAS ---
const cashoutMemoryGame = (req, res) => {
    const { gameId } = req.body;
    const userId = req.user.id;

    const sqlGetGame = 'SELECT * FROM active_memory_games WHERE id = ? AND user_id = ?';
    db.get(sqlGetGame, [gameId, userId], (err, game) => {
        if (err || !game) return res.status(404).json({ message: "Partida no encontrada." });

        const completedLevels = game.current_level - 1;
        let payout = 0;
        
        if (completedLevels > 0) {
            // Replicamos la fórmula del frontend en el backend para seguridad
            const multiplier = parseFloat(Math.pow(1.35, completedLevels).toFixed(2));
            payout = Math.floor(game.bet_amount * multiplier);
        } else {
            // Si cobra en el nivel 1, se le devuelve la apuesta original
            payout = game.bet_amount;
        }

        db.get('SELECT coins FROM users WHERE id = ?', [userId], (err, user) => {
            const finalBalance = user.coins + payout;
            db.run('UPDATE users SET coins = ? WHERE id = ?', [finalBalance, userId]);
            db.run('DELETE FROM active_memory_games WHERE id = ?', [gameId]);

            res.status(200).json({
                message: `¡Retirada exitosa! Ganaste ${payout} monedas.`,
                payout: payout,
                newBalance: finalBalance,
                gameState: "game_over"
            });
        });
    });
};

// --- RULETA DE CASINO: GIRAR ---
const spinCasinoRoulette = (req, res) => {
    const { bets } = req.body;
    const userId = req.user.id;

    if (typeof bets !== 'object' || Object.keys(bets).length === 0) {
        return res.status(400).json({ message: "No se han proporcionado apuestas válidas." });
    }

    const totalBet = Object.values(bets).reduce((sum, amount) => sum + amount, 0);
    if (totalBet <= 0) {
        return res.status(400).json({ message: "La apuesta total debe ser mayor que cero." });
    }

    db.get('SELECT coins FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ message: "Error del usuario." });
        if (user.coins < totalBet) return res.status(402).json({ message: "Fondos insuficientes." });

        // 1. Generar resultado seguro en el servidor
        const winningNumber = Math.floor(Math.random() * 37); // Números del 0 al 36

        // 2. Calcular ganancias
        const payout = calculateRouletteWinnings(winningNumber, bets);

        // 3. Calcular nuevo saldo
        const newBalance = user.coins - totalBet + payout;

        // 4. Actualizar el saldo del usuario en la BBDD
        db.run('UPDATE users SET coins = ? WHERE id = ?', [newBalance, userId], (err) => {
            if (err) return res.status(500).json({ message: "Error al actualizar el saldo." });

            // 5. Registrar la jugada en el historial
            const betDetailsJSON = JSON.stringify(bets);
            const resultJSON = JSON.stringify({ winningNumber });
            const sqlHistory = `INSERT INTO game_history (user_id, game_type, bet_details, result, payout) VALUES (?, ?, ?, ?, ?)`;
			const netPayout = payout - totalBet;
            db.run(sqlHistory, [userId, 'roulette', betDetailsJSON, resultJSON, netPayout]);

            // 6. Enviar respuesta al cliente
            res.status(200).json({
                winningNumber,
                payout,
                newBalance
            });
        });
    });
};

// --- OBTENER HISTORIAL DE JUEGOS ---
const getGameHistory = (req, res) => {
    const { gameType } = req.params; // Obtenemos el tipo de juego de la URL
    const validGameTypes = ['dice', 'roulette', 'blackjack']; // Lista de juegos con historial

    if (!validGameTypes.includes(gameType)) {
        return res.status(400).json({ message: "Tipo de juego no válido." });
    }

    // Buscamos los últimos 15 resultados para ese juego
    const sql = `SELECT result, created_at FROM game_history 
                 WHERE game_type = ? 
                 ORDER BY created_at DESC 
                 LIMIT 15`;

    db.all(sql, [gameType], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: "Error al obtener el historial del juego." });
        }
        // Parseamos el JSON de 'result' antes de enviarlo
        const history = rows.map(row => ({
            ...JSON.parse(row.result),
            timestamp: row.created_at
        }));
        res.status(200).json(history);
    });
};

module.exports = { rollDice, dealBlackjack, hitBlackjack, standBlackjack, buyLotteryTicket, getLotteryInfo, startMemoryGame, guessMemorySequence, cashoutMemoryGame, spinCasinoRoulette, getGameHistory};