// database/database.js
const { Pool } = require('pg');

// El Pool es la forma recomendada de interactuar con la base de datos.
// Gestiona un "pool" de conexiones, reutilizándolas eficientemente.
// Lee automáticamente la variable de entorno DATABASE_URL que configuraste.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Si estás desplegando en un entorno que requiere SSL, como Vercel,
    // es importante añadir esta configuración:
    ssl: {
        rejectUnauthorized: false
    }
});

// Verificamos la conexión
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error al conectar con la base de datos PostgreSQL:', err.stack);
    } else {
        console.log('Conectado exitosamente a PostgreSQL (Supabase).');
    }
});

// Ya no necesitamos la función initDb, porque las tablas ya existen en Supabase.

// Exportamos el pool. Lo llamaremos 'db' para minimizar los cambios en los controladores.
module.exports = { db: pool };