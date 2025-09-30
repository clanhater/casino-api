# Casino KRULE - API de Backend

¡Bienvenido a la documentación oficial de la API del Casino KRULE! Este backend ha sido desarrollado para gestionar toda la lógica, seguridad y persistencia de datos del casino online, permitiendo una experiencia de juego justa y segura para todos los jugadores.

Este documento sirve como guía para desarrolladores de frontend que necesiten integrar la API en la interfaz de usuario.

---

## 🌐 API en Vivo

¡La API está desplegada y lista para usar!

**URL Base de Producción:** `https://casino-api-rose.vercel.app/`

Puedes usar esta URL para integrar el frontend directamente o para hacer pruebas con herramientas como Postman. Para el desarrollo local, sigue las instrucciones de la siguiente sección.

---

## 🚀 Cómo Empezar

Para ejecutar este proyecto en un entorno de desarrollo local, sigue estos pasos:

### **Requisitos Previos**
-   [Node.js](https://nodejs.org/) (versión 16 o superior recomendada)
-   npm (generalmente se instala con Node.js)

### **Instalación**

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/casino-api.git
    cd casino-api
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

3.  **Configura las variables de entorno:**
    Crea un archivo llamado `.env` en la raíz del proyecto y añade la siguiente variable. Esta clave es crucial para la seguridad de los tokens de sesión.
    ```
    JWT_SECRET="una_clave_secreta_muy_larga_y_dificil_de_adivinar"
    ```

4.  **Ejecuta el servidor en modo de desarrollo:**
    Este comando utiliza `nodemon` para reiniciar automáticamente el servidor cada vez que hagas un cambio en el código.
    ```bash
    npm run dev
    ```

El servidor estará escuchando en `http://localhost:3000`.

---

## 📖 Documentación de Endpoints

La URL base para todos los endpoints es `http://localhost:3000`.

### **Autenticación y Sesiones**

Todas las peticiones a endpoints protegidos deben incluir la siguiente cabecera HTTP:
`Authorization: Bearer <TU_TOKEN_JWT>`

#### **1. Registrar un Nuevo Usuario**
-   **Endpoint:** `POST /api/auth/register`
-   **Descripción:** Crea una nueva cuenta de usuario. Los usuarios nuevos comienzan con 0 monedas.
-   **Body (JSON):**
    ```json
    {
        "username": "nuevo_jugador",
        "password": "una_contraseña_segura"
    }
    ```
-   **Respuesta Exitosa (201 Created):**
    ```json
    {
        "message": "Usuario registrado con éxito.",
        "userId": 5
    }
    ```

#### **2. Iniciar Sesión**
-   **Endpoint:** `POST /api/auth/login`
-   **Descripción:** Autentica a un usuario y devuelve un token JWT para usar en futuras peticiones.
-   **Body (JSON):**
    ```json
    {
        "username": "nuevo_jugador",
        "password": "una_contraseña_segura"
    }
    ```
-   **Respuesta Exitosa (200 OK):**
    ```json
    {
        "message": "Inicio de sesión exitoso.",
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
            "id": 5,
            "username": "nuevo_jugador",
            "coins": 0
        }
    }
    ```

---

### **Gestión de Perfil de Usuario**

#### **1. Obtener Datos del Perfil**
-   **Endpoint:** `GET /api/user/profile`
-   **Protección:** 🔒 Requiere Token
-   **Descripción:** Devuelve la información completa del usuario autenticado.
-   **Respuesta Exitosa (200 OK):**
    ```json
    {
        "id": 5,
        "username": "nuevo_jugador",
        "coins": 1250,
        "profile_pic_base64": "data:image/png;base64,iVBORw0...",
        "created_at": "2025-09-29T12:00:00.000Z"
    }
    ```

#### **2. Actualizar Perfil**
-   **Endpoint:** `PUT /api/user/profile`
-   **Protección:** 🔒 Requiere Token
-   **Descripción:** Actualiza el nombre de usuario y/o la foto de perfil. Si el nombre de usuario cambia, se devuelve un nuevo token JWT que **debe** ser guardado y utilizado a partir de ese momento.
-   **Body (JSON) - Ejemplo 1 (cambio de nombre):**
    ```json
    { "newUsername": "jugador_PRO" }
    ```
-   **Body (JSON) - Ejemplo 2 (cambio de foto):**
    ```json
    { "profilePic": "data:image/png;base64,iVBORw0KGgoAAA..." }
    ```
-   **Respuesta Exitosa (200 OK):**
    ```json
    // Si el nombre cambió
    { "message": "Perfil actualizado con éxito.", "newToken": "eyJ...un_nuevo_token" }
    // Si solo la foto cambió
    { "message": "Perfil actualizado con éxito." }
    ```

---

### **Juegos**

#### **1. Dados**
-   **Endpoint:** `POST /api/games/dice/roll`
-   **Protección:** 🔒 Requiere Token
-   **Descripción:** Realiza una tirada de dados.
-   **Body (JSON):**
    ```json
    {
        "bet": 50,
        "mode": "under", // "under" o "over"
        "target": 75
    }
    ```
-   **Respuesta Exitosa (200 OK):**
    ```json
    {
        "message": "¡Ganaste!",
        "rollResult": 15.34,
        "isWin": true,
        "payout": 66, // Retorno total
        "newBalance": 1016
    }
    ```

#### **2. Blackjack**
-   **Iniciar Partida:** `POST /api/games/blackjack/deal`
    -   **Body:** `{ "bet": 100 }`
    -   **Respuesta:** `{ "gameId": 1, "playerHand": [...], "dealerHand": [...] ... }`
-   **Pedir Carta:** `POST /api/games/blackjack/hit`
    -   **Body:** `{ "gameId": 1 }`
    -   **Respuesta:** `{ "playerHand": [...], "playerScore": 18 }`
-   **Plantarse:** `POST /api/games/blackjack/stand`
    -   **Body:** `{ "gameId": 1 }`
    -   **Respuesta:** `{ "message": "¡Ganaste!", "payout": 200, "newBalance": 1200 ... }`

#### **3. Juego de Memoria**
-   **Iniciar Partida:** `POST /api/games/memory/start`
    -   **Body:** `{ "bet": 20 }`
    -   **Respuesta:** `{ "gameId": 2, "nextSequence": ["red"], ... }`
-   **Adivinar Secuencia:** `POST /api/games/memory/guess`
    -   **Body:** `{ "gameId": 2, "playerSequence": ["red"] }`
    -   **Respuesta:** `{ "result": "correct", "nextSequence": ["red", "blue"], ... }`
-   **Retirar Ganancias:** `POST /api/games/memory/cashout`
    -   **Body:** `{ "gameId": 2 }`
    -   **Respuesta:** `{ "message": "¡Retirada exitosa!", "payout": 27, "newBalance": 1007, ... }`

#### **4. Ruleta de Casino**
-   **Endpoint:** `POST /api/games/casino-roulette/spin`
-   **Protección:** 🔒 Requiere Token
-   **Descripción:** Realiza un giro en la ruleta de casino con múltiples apuestas.
-   **Body (JSON):**
    ```json
    {
        "bets": {
            "red": 100,
            "17": 10,
            "dozen1": 50
        }
    }
    ```
-   **Respuesta Exitosa (200 OK):**
    ```json
    {
        "winningNumber": 17, // (Número ganador del 0 al 36)
        "payout": 510, // Retorno total
        "newBalance": 1350
    }
    ```

---

### **Recompensas y Eventos Diarios**

#### **1. Ruleta Diaria (Recompensa)**
-   **Consultar Estado:** `GET /api/rewards/daily-roulette/status`
    -   **Respuesta:** `{ "canSpin": true }` o `{ "canSpin": false, "nextSpinTime": "..." }`
-   **Girar la Ruleta:** `POST /api/rewards/daily-roulette/spin`
    -   **Respuesta:** `{ "message": "¡Ganaste 250 monedas!", "prizeWon": 250, "newBalance": 1500 }`

#### **2. Lotería**
-   **Consultar Información:** `GET /api/games/lottery/info`
    -   **Respuesta:** `{ "yesterdaysDraw": [10, 45, 88], "userTicketForToday": [5, 15, 25] }`
-   **Comprar Boleto:** `POST /api/games/lottery/buy`
    -   **Body:** `{ "numbers": [5, 15, 25] }`
    -   **Respuesta:** `{ "message": "Boleto comprado con éxito.", ... }`

---

### **Historial de Juegos**

-   **Endpoint:** `GET /api/games/:gameType/history`
-   **Protección:** 🔒 Requiere Token
-   **Descripción:** Obtiene los últimos 15 resultados para un juego específico. `:gameType` puede ser `dice`, `roulette`, o `blackjack`.
-   **Ejemplo de URL:** `GET /api/games/roulette/history`
-   **Respuesta Exitosa (200 OK):**
    ```json
    [
        { "winningNumber": 29, "timestamp": "..." },
        { "winningNumber": 14, "timestamp": "..." }
    ]
    ```

---

### 🛠️ Stack Tecnológico

-   **Framework:** Node.js, Express.js
-   **Base de Datos:** PostgreSQL (alojada en Supabase).
-   **Autenticación:** JWT (JSON Web Tokens) con `bcrypt` para el hasheo de contraseñas.
-   **Tareas Programadas:** `node-cron` para la lotería diaria.
-   **Despliegue:** Vercel.

---

¡Buena suerte y a jugar!