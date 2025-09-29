// Importamos el driver de sqlite3
const sqlite3 = require('sqlite3').verbose();

// Definimos la ruta y el nombre de nuestro archivo de base de datos.
// Se creará automáticamente si no existe.
const DB_SOURCE = "database/casino.db";

// Creamos y conectamos a la base de datos.
// El objeto 'db' es nuestra puerta de entrada para ejecutar comandos SQL.
const db = new sqlite3.Database(DB_SOURCE, (err) => {
    if (err) {
      // No se puede abrir la base de datos
      console.error(err.message);
      throw err;
    } else {
        console.log('Conectado a la base de datos SQLite.');
    }
});

// Función para inicializar la base de datos y crear las tablas necesarias.
const initDb = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            coins INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.run(sql, (err) => {
        if (err) {
            console.error("Error al crear la tabla 'users':", err.message);
        } else {
            console.log("Tabla 'users' lista y verificada.");
        }
    });
	
	// NUEVO: Añadir columna para la ruleta si no existe
    // Usamos PRAGMA para verificar si la columna ya fue añadida
    db.all("PRAGMA table_info(users)", (err, cols) => { // <-- CAMBIO DE .get A .all
		if (err) { 
			console.error("Error al leer la información de la tabla 'users':", err.message);
			return; 
		}
		// Ahora 'cols' es un array y .some() funcionará
		const hasColumn = cols && cols.some(col => col.name === 'last_roulette_spin');
		if (!hasColumn) {
			db.run("ALTER TABLE users ADD COLUMN last_roulette_spin TIMESTAMP", (err) => {
				if(err) console.error("Error al añadir columna a 'users':", err.message);
				else console.log("Columna 'last_roulette_spin' añadida a 'users'.");
			});
		}
		
		const hasPicColumn = cols && cols.some(col => col.name === 'profile_pic_base64');
		if (!hasPicColumn) {
			db.run("ALTER TABLE users ADD COLUMN profile_pic_base64 TEXT", (err) => {
				if(err) console.error("Error al añadir columna de foto de perfil:", err.message);
				else console.log("Columna 'profile_pic_base64' añadida a 'users'.");
			});
		}
	});
	
	// NUEVO: Tabla para los sorteos de lotería
    const sqlLotteryDraws = `
        CREATE TABLE IF NOT EXISTS lottery_draws (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            draw_date TEXT NOT NULL UNIQUE,
            winning_numbers TEXT NOT NULL
        )
    `;
    db.run(sqlLotteryDraws, (err) => {
        if(err) console.error("Error al crear tabla 'lottery_draws':", err.message);
        else console.log("Tabla 'lottery_draws' lista.");
    });

    // NUEVO: Tabla para los boletos de lotería comprados por los usuarios
    const sqlLotteryTickets = `
        CREATE TABLE IF NOT EXISTS lottery_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            draw_date TEXT NOT NULL,
            chosen_numbers TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `;
    db.run(sqlLotteryTickets, (err) => {
        if(err) console.error("Error al crear tabla 'lottery_tickets':", err.message);
        else console.log("Tabla 'lottery_tickets' lista.");
    });
	
	const sqlBlackjack = `
        CREATE TABLE IF NOT EXISTS active_blackjack_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            deck TEXT NOT NULL,
            player_hand TEXT NOT NULL,
            dealer_hand TEXT NOT NULL,
            bet_amount INTEGER NOT NULL,
            game_state TEXT NOT NULL DEFAULT 'player_turn', -- Estados: player_turn, game_over
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `;
    db.run(sqlBlackjack, (err) => {
        if (err) {
            console.error("Error al crear la tabla 'active_blackjack_games':", err.message);
        } else {
            console.log("Tabla 'active_blackjack_games' lista y verificada.");
        }
    });
	
	const sqlMemoryGames = `
        CREATE TABLE IF NOT EXISTS active_memory_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            bet_amount INTEGER NOT NULL,
            current_sequence TEXT NOT NULL,
            current_level INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `;
    db.run(sqlMemoryGames, (err) => {
        if (err) {
            console.error("Error al crear la tabla 'active_memory_games':", err.message);
        } else {
            console.log("Tabla 'active_memory_games' lista y verificada.");
        }
    });
	
	// NUEVO: Crear la tabla para el historial de todas las partidas
    const sqlGameHistory = `
        CREATE TABLE IF NOT EXISTS game_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            game_type TEXT NOT NULL, -- 'roulette', 'dice', 'blackjack', etc.
            bet_details TEXT NOT NULL, -- Un JSON con las apuestas realizadas
            result TEXT NOT NULL, -- Un JSON con el resultado (ej. número ganador)
            payout INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `;
    db.run(sqlGameHistory, (err) => {
        if (err) {
            console.error("Error al crear la tabla 'game_history':", err.message);
        } else {
            console.log("Tabla 'game_history' lista y verificada.");
        }
    });
};

// Exportamos la conexión y la función de inicialización para usarlas en otros archivos.
module.exports = { db, initDb };