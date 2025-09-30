// controllers/rewardController.js
const { db } = require('../database/database.js');

// --- RULETA DIARIA: OBTENER ESTADO (Refactorizada para PostgreSQL) ---
const getDailyRouletteStatus = async (req, res) => {
    const userId = req.user.id;
    try {
        const sql = 'SELECT last_roulette_spin FROM users WHERE id = $1';
        const result = await db.query(sql, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        const user = result.rows[0];
        const now = new Date();
        const lastSpin = user.last_roulette_spin ? new Date(user.last_roulette_spin) : null;
        
        if (!lastSpin || (now.getTime() - lastSpin.getTime()) >= 24 * 60 * 60 * 1000) {
            return res.status(200).json({ canSpin: true });
        } else {
            const nextSpinTime = new Date(lastSpin.getTime() + 24 * 60 * 60 * 1000);
            return res.status(200).json({ canSpin: false, nextSpinTime });
        }
    } catch (err) {
        console.error("Error en getDailyRouletteStatus:", err);
        res.status(500).json({ message: "Error en el servidor al verificar el estado de la ruleta." });
    }
};

// --- RULETA DIARIA: GIRAR (Refactorizada para PostgreSQL) ---
const spinDailyRoulette = async (req, res) => {
    const userId = req.user.id;
    try {
        // 1. Obtener los datos del usuario
        const sqlGetUser = 'SELECT coins, last_roulette_spin FROM users WHERE id = $1';
        const result = await db.query(sqlGetUser, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }
        const user = result.rows[0];

        // 2. Verificar si el usuario puede girar (misma lógica de antes)
        const now = new Date();
        const lastSpin = user.last_roulette_spin ? new Date(user.last_roulette_spin) : null;
        
        if (lastSpin && (now.getTime() - lastSpin.getTime()) < 24 * 60 * 60 * 1000) {
            return res.status(403).json({ message: "Ya has girado la ruleta hoy." });
        }

        // 3. Calcular el premio (misma lógica de antes)
        const prizes = [
            { prize: 50, weight: 40 },
            { prize: 100, weight: 30 },
            { prize: 250, weight: 15 },
            { prize: 500, weight: 10 },
            { prize: 1000, weight: 5 },
        ];
        const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;
        let prizeWon = 0;
        for (const p of prizes) {
            if (random < p.weight) {
                prizeWon = p.prize;
                break;
            }
            random -= p.weight;
        }

        // 4. Actualizar la base de datos
        const newBalance = user.coins + prizeWon;
        const sqlUpdate = 'UPDATE users SET coins = $1, last_roulette_spin = $2 WHERE id = $3';
        await db.query(sqlUpdate, [newBalance, now.toISOString(), userId]);

        // 5. Enviar la respuesta
        res.status(200).json({ message: `¡Ganaste ${prizeWon} monedas!`, prizeWon, newBalance });

    } catch (err) {
        console.error("Error en spinDailyRoulette:", err);
        res.status(500).json({ message: "Error en el servidor al girar la ruleta." });
    }
};

module.exports = { getDailyRouletteStatus, spinDailyRoulette };