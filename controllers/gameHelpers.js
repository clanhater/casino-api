// controllers/gameHelpers.js

// Función para crear una baraja estándar de 52 cartas
const createDeck = () => {
    const suits = ['♥', '♦', '♣', '♠'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
};

// Función para barajar la baraja (algoritmo Fisher-Yates)
const shuffleDeck = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

// Función para obtener el valor numérico de una carta
const getCardValue = (rank) => {
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    if (rank === 'A') return 11;
    return parseInt(rank);
};

// Función para calcular la puntuación total de una mano
const calculateScore = (hand) => {
    let score = 0;
    let aceCount = 0;
    hand.forEach(card => {
        score += getCardValue(card.rank);
        if (card.rank === 'A') {
            aceCount++;
        }
    });
    // Ajustar el valor de los Ases si el puntaje supera 21
    while (score > 21 && aceCount > 0) {
        score -= 10;
        aceCount--;
    }
    return score;
};

module.exports = { createDeck, shuffleDeck, calculateScore };