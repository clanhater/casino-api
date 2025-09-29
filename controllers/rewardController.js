// controllers/rewardController.js
const { db } = require('../database/database.js');

// --- RULETA DIARIA: OBTENER ESTADO ---
const getDailyRouletteStatus = (req, res) => {
    const userId = req.user.id;
    db.get('SELECT last_roulette_spin FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ message: "Error al obtener datos del usuario." });

        const now = new Date();
        const lastSpin = user.last_roulette_spin ? new Date(user.last_roulette_spin) : null;
        
        if (!lastSpin || (now.getTime() - lastSpin.getTime()) >= 24 * 60 * 60 * 1000) {
            return res.status(200).json({ canSpin: true });
        } else {
            const nextSpinTime = new Date(lastSpin.getTime() + 24 * 60 * 60 * 1000);
            return res.status(200).json({ canSpin: false, nextSpinTime });
        }
    });
};

// --- RULETA DIARIA: GIRAR ---
const spinDailyRoulette = (req, res) => {
    const userId = req.user.id;
    // Doble verificación para evitar trampas
    db.get('SELECT coins, last_roulette_spin FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ message: "Error al obtener datos del usuario." });
        
        const now = new Date();
        const lastSpin = user.last_roulette_spin ? new Date(user.last_roulette_spin) : null;
        
        if (lastSpin && (now.getTime() - lastSpin.getTime()) < 24 * 60 * 60 * 1000) {
            return res.status(403).json({ message: "Ya has girado la ruleta hoy." });
        }

        // Premios posibles y sus probabilidades (suma de pesos = 100)
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

        const newBalance = user.coins + prizeWon;
        const sqlUpdate = 'UPDATE users SET coins = ?, last_roulette_spin = ? WHERE id = ?';
        db.run(sqlUpdate, [newBalance, now.toISOString(), userId], (err) => {
            if (err) return res.status(500).json({ message: "Error al actualizar tu premio." });
            res.status(200).json({ message: `¡Ganaste ${prizeWon} monedas!`, prizeWon, newBalance });
        });
    });
};

module.exports = { getDailyRouletteStatus, spinDailyRoulette };