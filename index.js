require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDb } = require('./database/database.js');
const { startLotteryCron } = require('./services/cronJobs');

// Importar las rutas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const gameRoutes = require('./routes/gameRoutes');
const rewardRoutes = require('./routes/rewardRoutes');

// Inicializar la aplicación Express
const app = express();
const PORT = 3000;

// --- CONFIGURACIÓN DE CORS ---
const whitelist = [
    'http://127.0.0.1:5500', // Origen común para Live Server de VS Code
    'http://localhost:5500',
    'http://localhost:8080', // Otro puerto común de desarrollo
	'https://casino-five-sand.vercel.app/',
];

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir peticiones sin 'origin' (como las de Postman o apps móviles)
        // O si el origen está en nuestra lista blanca
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos permitidos
    allowedHeaders: ['Content-Type', 'Authorization'] // Cabeceras permitidas
};

// --- MIDDLEWARES ---
app.use(cors(corsOptions)); // <-- 2. USAR EL MIDDLEWARE DE CORS CON LA CONFIGURACIÓN
app.use(express.json({ limit: '1mb' }));

// Inicializar la base de datos
initDb();
startLotteryCron();

// Middleware para entender JSON
// Limita el tamaño del body a 4MB para prevenir ataques
app.use(express.json({ limit: '4mb' }));

// --- ENDPOINTS DE LA API ---

// Usar las rutas
app.use('/api/auth', authRoutes); // Todas las rutas en authRoutes empezarán con /api/auth
app.use('/api/user', userRoutes); // Todas las rutas en userRoutes empezarán con /api/user
app.use('/api/games', gameRoutes); // Todas las rutas en gameRoutes empezarán con /api/games
app.use('/api/rewards', rewardRoutes);

// Endpoint de prueba
app.get('/api/status', (req, res) => {
    res.json({ status: "ok", message: "Servidor API del casino funcionando correctamente." });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});