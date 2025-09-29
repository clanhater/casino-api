// services/cronJobs.js
const cron = require('node-cron');
const { db } = require('../database/database.js');

const LOTTERY_PRIZE = 10000; // Premio gordo

// Función que realiza el sorteo
const performLotteryDraw = async () => {
    console.log('Ejecutando el sorteo diario de la lotería...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const drawDate = yesterday.toISOString().split('T')[0];

    // 1. Generar números ganadores
    const winningNumbers = new Set();
    while (winningNumbers.size < 3) {
        winningNumbers.add(Math.floor(Math.random() * 99) + 1);
    }
    const winningArray = Array.from(winningNumbers);

    // 2. Obtener todos los boletos para el sorteo de ayer
    db.all('SELECT user_id, chosen_numbers FROM lottery_tickets WHERE draw_date = ?', [drawDate], (err, tickets) => {
        if (err || !tickets) return console.error("Error al obtener boletos de lotería.");
        
        const winners = [];
        tickets.forEach(ticket => {
            const chosen = new Set(JSON.parse(ticket.chosen_numbers));
            const matches = winningArray.filter(num => chosen.has(num)).length;
            if (matches === 3) {
                winners.push(ticket.user_id);
            }
        });

        // 3. Repartir el premio entre los ganadores
        if (winners.length > 0) {
            const prizePerWinner = Math.floor(LOTTERY_PRIZE / winners.length);
            const sqlUpdateWinner = 'UPDATE users SET coins = coins + ? WHERE id = ?';
            winners.forEach(userId => {
                db.run(sqlUpdateWinner, [prizePerWinner, userId]);
                console.log(`Usuario ${userId} ganó ${prizePerWinner} monedas en la lotería!`);
            });
        }

        // 4. Guardar el resultado del sorteo
        db.run('INSERT INTO lottery_draws (draw_date, winning_numbers) VALUES (?, ?)', 
            [drawDate, JSON.stringify(winningArray)],
            () => console.log(`Sorteo del ${drawDate} completado. Números: ${winningArray.join(', ')}`)
        );
    });
};

// Programar la tarea para que se ejecute todos los días a las 00:05 AM
const startLotteryCron = () => {
    // '5 0 * * *' -> a los 5 minutos de la medianoche, todos los días
    cron.schedule('5 0 * * *', performLotteryDraw);
    console.log('Tarea programada de lotería iniciada.');
};

module.exports = { startLotteryCron };