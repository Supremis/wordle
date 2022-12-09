const mongoose = require('mongoose');

const Users = mongoose.model('User', new mongoose.Schema({
    id: String,
    name: String,
    stats: {
        singleplayer: {
            correct: Number,
            incorrect: Number,
        },
        multiplayer: {
            correct: Number,
            incorrect: Number,
        }
    },
    games: [String]
}));

const Games = mongoose.model('Game', new mongoose.Schema({
    id: String,
    type: String,
    players: [String],
    word: String,
    guesses: mongoose.Schema.Types.Mixed,
    results: mongoose.Schema.Types.Mixed,
    active: Boolean,
    usedHint: mongoose.Schema.Types.Mixed,
    filled: Boolean,
    winner: String,
}, { minimize: false }));

module.exports = { Users, Games };