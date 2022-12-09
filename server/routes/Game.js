const { Router } = require('express');
const { Server } = require('../WebSocket');
const { Users, Games } = require('../database/Models');
const { common, all } = require('../words');

const GameRouter = Router();

Array.prototype.shuffle = function() {
    let currentIndex = this.length, randomIndex;
  
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
  
      [this[currentIndex], this[randomIndex]] = [
        this[randomIndex], this[currentIndex]];
    }  
};

GameRouter.route('/resume')
    .post(async (request, response) => {
        const { id, type } = request.body;
        if (typeof id !== 'string' || typeof type !== 'string') return response.send('no botting.');

        const user = await Users.findOne({ id, });
        if (!user) return response.status(401).json({ status: 'ERROR', data: { message: 'You are not registered as being logged in. Please try again later.' } });

        const recent = user.games[0];
        const game = await Games.findOne({ id: recent, });
    
        if (game?.type !== type) return response.json({ status: 'SUCCESS', data: { active: false, guesses: { player: [], opponent: [] }, results: { player: [], opponent: [] }, } });
        if (!game?.active) return response.json({ status: 'SUCCESS', data: { active: false, guesses: { player: [], opponent: [] }, results: { player: [], opponent: [] }, } });
        const opponent = game?.players.find(player => player !== user.name);
        
        response.json({
            status: 'SUCCESS',
            data: {
                active: true,
                guesses: {
                    player: game?.guesses[user.name] || [],
                    opponent: game?.guesses[opponent]|| [],
                },
                results: {
                    player: game?.results[user.name] || [],
                    opponent: game?.results[opponent] || [],
                },
                players: game?.players,
            },
        });
    });

GameRouter.route('/cancel') 
    .post(async (request, response) => {
        const { id } = request.body;
        if (typeof id !== 'string') return response.send('no botting.');

        const user = await Users.findOne({ id, });
        if (!user) return response.status(401).json({ status: 'ERROR', data: { message: 'You are not registered as being logged in. Please try again later.' } });

        const recent = user.games[0];
        const game = await Games.findOne({ id: recent, });

        if (!game) return response.status(400).json({ status: 'ERROR', data: { message: 'You are not in any games.', } });
        if (game.type !== 'multiplayer') return response.send('no botting.');
        if (game.players.length !== 2) return response.status(400).json({ status: 'ERROR', data: { message: 'The gamae has already started.' } });

        user.games = [];
        Games.findOneAndDelete({ id: recent, })
            .then(() => {
                user.save()
                    .then(() => {
                        response.json({
                            status: 'SUCCESS',
                            data: { message: 'Successfully cancelled game.' },
                        });
                    })
                    .catch(error => {
                        console.error(error);

                        response.status(500).json({
                            status: 'ERROR',
                            data: { message: 'An internal error occured when starting a game. Please retry later.', dev_error: error, },
                        });
                    });
            })
            .catch(error => {
                console.error(error);

                response.status(500).json({
                    status: 'ERROR',
                    data: { message: 'An internal error occured when cancelling the game. Please retry later.', dev_error: error, },
                });
            });
    });

GameRouter.route('/list')
    .get(async (_request, response) => {
        const games = await Games.find();
        const lobbies = games.filter(game => !game.filled).reverse().map(game => game.id);

        response.json({ status: 'SUCCESS', data: { lobbies, } });
    });

GameRouter.route('/join')
    .post(async (request, response) => {
        const { id, code } = request.body;
        if (typeof id !== 'string' || typeof code !== 'string') return response.send('no botting.');

        const user = await Users.findOne({ id, });
        if (!user) return response.status(401).json({ status: 'ERROR', data: { message: 'You are not registered as being logged in. Please try again later.' } });
        if (user.games.length) return response.status(400).json({ status: 'ERROR', data: { message: 'You are already in an existing game.' } });

        const game = await Games.findOne({ id: code, });
        if (!game || game.type !== 'multiplayer') return response.status(400).json({ status: 'ERROR', data: { message: 'Invalid invite code.' } });

        if (game.players.length >= 2) return response.status(400).json({ status: 'ERROR', data: { message: 'Game has filled.' } });

        game.players.push(user.name);
        game.guesses[user.name] = [];
        game.results[user.name] = [];
        game.usedHint[user.name] = false;
        game.filled = true;

        user.games.push(game.id);

        game.markModified('guesses');
        game.markModified('results');
        game.markModified('usedHint');
        game.save()
            .then(() => {
                user.save()
                    .then(() => {
                        Server.brodcast(JSON.stringify({
                            header: 'START_GAME',
                            data: {
                                players: game.players,
                            },
                        }), client => game.players.includes(client.user?.name));


                        console.log('g create');
                        setTimeout(async () => {
                            const game = await Games.findOne({ id: code, });
                            if (!game) return; // wtf

                            if (game.active) {
                                game.active = false;
                                if (!game.winner || game.winner.includes('Not')) game.winner = 'Nobody';

                                const players = [...Server.clients].filter(client => game.players.includes(client.user?.name));
    
                                for (let player of players) {
                                    const user = await Users.findOne({ name: player.user.name });
    
                                    user.stats.multiplayer.incorrect++;
                                    user.games = [];
                                    await user.save();
                                }

                                game.markModified('guesses');
                                game.markModified('results');
                                game.markModified('usedHint');
                                game.save()
                                    .then(() => {
                                        Server.brodcast(JSON.stringify({
                                            header: 'END_GAME',
                                            data: {
                                                winner: game.winner,
                                                word: game.word,
                                            }
                                        }), client => game.players.includes(client.user?.name));
                                    });
                            }
                        }, 60200);
                        
                        response.json({ status: 'SUCCESS', });
                    })
                    .catch(error => {
                        console.error(error);

                        response.status(500).json({
                            status: 'ERROR',
                            data: { message: 'An internal error occured when starting a game. Please retry later.', dev_error: error, },
                        });
                    });
            })
            .catch(error => {
                console.error(error);

                response.status(500).json({
                    status: 'ERROR',
                    data: { message: 'An internal error occured when starting a game. Please retry later.', dev_error: error, },
                });
            });
    }); 

GameRouter.route('/start')
    .post(async (request, response) => {        
        const { id, type } = request.body;
        if (typeof id !== 'string' || typeof type !== 'string') return response.send('no botting.');

        const user = await Users.findOne({ id, });
        if (!user) return response.status(401).json({ status: 'ERROR', data: { message: 'You are not registered as being logged in. Please try again later.' } });

        if (user.games.length) return response.status(400).json({ status: 'ERROR', data: { message: 'You are already in an existing game.' } });
        
        common.shuffle();
        console.log(common[0]);
        
        const gameID = require('crypto').randomBytes(8).toString('hex');

        const guesses = {};
        const results = {};
        const usedHint = {};

        guesses[user.name] = [];
        results[user.name] = [];
        usedHint[user.name] = false;

        const game = new Games({
            id: gameID,
            type,
            players: [user.name],
            word: common[0],
            guesses,
            results,
            active: true,
            usedHint,
            filled: type === 'multiplayer' ? false : true,
            winner: '',
        });

        user.games.push(gameID);

        game.markModified('guesses');
        game.markModified('results');
        game.markModified('usedHint');
        game.save()
            .then(() => {
                user.save()
                    .then(() => {
                        response.json({ status: 'SUCCESS', });
                    })
                    .catch(error => {
                        console.error(error);

                        response.status(500).json({
                            status: 'ERROR',
                            data: { message: 'An internal error occured when starting a game. Please retry later.', dev_error: error, },
                        });
                    });
            })
            .catch(error => {
                console.error(error);

                response.status(500).json({
                    status: 'ERROR',
                    data: { message: 'An internal error occured when starting a game. Please retry later.', dev_error: error, },
                });
            });
    }); 

GameRouter.route('/hint')
    .post(async (request, response) => {
        const { id } = request.body;
        if (typeof id !== 'string') return response.send('no botting.');

        const user = await Users.findOne({ id, });
        if (!user) return response.status(401).json({ status: 'ERROR', data: { message: 'You are not registered as being logged in. Please try again later.' } });

        const recent = user.games[0];
        const game = await Games.findOne({ id: recent, });

        if (!game) return response.status(500).json({ status: 'ERROR', data: { message: 'An internal error occured when trying to attempt a guess for this game.', } });

        if (!game.active) return response.status(400).json({ status: 'ERROR', data: { message: 'The current game has already been completed. Start a new game by reloading to continue playing.' } });
        if (game.usedHint[user.name]) return response.status(400).json({ status: 'ERROR', data: { message: 'You already used a hint for this game.' } });

        let greenPositions = [];
        game.results[user.name].forEach(result => {
            for (let i = 0; i < result.length; i++) {
                if (result[i] === 'c') greenPositions.push(i);
            }
        });

        let hint = { letter: null, position: null, };

        game.word.split('').forEach((letter, index) => {
            if (greenPositions.includes(index) || hint.letter) return;
            hint = { letter, position: index };
        });

        game.usedHint[user.name] = true;

        game.markModified('guesses');
        game.markModified('results');
        game.markModified('usedHint');
        game.save()
            .then(() => {
                user.save()
                    .then(() => {
                        response.json({ status: 'SUCCESS', data: { hint }, });
                    })
                    .catch(error => {
                        console.error(error);

                        response.status(500).json({
                            status: 'ERROR',
                            data: { message: 'An internal error occured when starting a game. Please retry later.', dev_error: error, },
                        });
                    });
            })
            .catch(error => {
                console.error(error);

                response.status(500).json({
                    status: 'ERROR',
                    data: { message: 'An internal error occured when starting a game. Please retry later.', dev_error: error, },
                });
            });
    }); 

GameRouter.route('/guess')
    .post(async (request, response) => {
        const { id, guess } = request.body;
        if (typeof id !== 'string' || typeof guess !== 'string') return response.send('no botting.');
        if (!all.includes(guess) && !common.includes(guess)) return response.status(400).json({ status: 'ERROR', data: { message: 'Invalid word.' } });

        const user = await Users.findOne({ id, });
        if (!user) return response.status(401).json({ status: 'ERROR', data: { message: 'You are not registered as being logged in. Please try again later.' } });

        const recent = user.games[0];
        if (!recent) return response.status(400).json({ status: 'ERROR', data: { message: 'You are not in any active games.' } });

        const game = await Games.findOne({ id: recent, });
        if (!game) return response.status(500).json({ status: 'ERROR', data: { message: 'An internal error occured when trying to attempt a guess for this game.', } });
        if (!game.active) return response.status(400).json({ status: 'ERROR', data: { message: 'The game has ended.' } });
        if (game.winner === `Not ${user.name}`) return response.status(400).json({ status: 'ERROR', data: { message: 'You have already lost.', } });

        if (!game.guesses[user.name]) game.guesses[user.name] = [];
        if (!game.results[user.name]) game.results[user.name] = [];
        if (!game.usedHint[user.name]) game.usedHint[user.name] = false;

        const data = { result: null, finished: false, };

        if (game.type === 'multiplayer' && game.players.length !== 2) return response.status(403).json({ status: 'ERROR', data: { message: 'No one has accepted your challenge yet.' } });

        game.guesses[user.name].push(guess);

        let result = '';
        let lettersDone = {};
    
        function ensurePartiality(letter) { // NOTE: This may be bugged, and is not fully tested yet.
            const split = { guess: guess.split(''), word: game.word.split(''), result: result.split('') };
    
            let partial = true;
            if (split.word.filter(l => l == letter).length < split.guess.filter(l => l == letter).length) {
                let difference = split.guess.filter(l => l == letter).length - split.word.filter(l => l == letter).length;
    
                if (!lettersDone[letter]) return lettersDone[letter] = 0;
                lettersDone[letter]++;
                if (lettersDone[letter] > difference) partial = false;
            }
    
            return partial;
        }
    
        guess.split('').forEach((letter, index) => {
            let split = game.word.split('');
    
            if (split[index] == letter) return result += 'c';
            if (split.includes(letter) && ensurePartiality(letter)) return result += 'p';
            result += 'n';
        });

        game.results[user.name].push(result);  

        if (game.type === 'multiplayer') {
            const player = game.players.find(player => player !== user.name);
            if (!player) return;
            const socket = [...Server.clients].find(client => client.user?.name === player);

            if (!socket) return console.log('Couldn\'t find opponent.');
            console.log('Found opponent!', player);

            if (socket.readyState === 1) {
                socket.send(JSON.stringify({
                    header: 'OPPONENT_RESULT',
                    data: { result, },
                }));
            } else {
                console.log(`Opponent's socket state is in CODE ${socket.readyState}.`);
            }
        }

        data.result = result;

        if (result === 'ccccc') {
            game.active = false;

            data.finished = true;
            data.word = game.word;
            data.failed = false;

            user.games = [];

            game.winner = user.name;

            if (game.type === 'multiplayer') {
                if (!game.winner || game.winner.includes('Not')) game.winner = user.name;

                game.markModified('guesses');
                game.markModified('results');
                game.markModified('usedHint');

                game.save()
                    .then(async () => {
                        const players = [...Server.clients].filter(client => game.players.includes(client.user?.name));

                        for (let player of players) {
                            const user = await Users.findOne({ name: player.user.name });

                            if (game.winner === user.name) {
                                console.log('winzer', user.name);
                                user.stats.multiplayer.correct++;
                            } else {
                                console.log('lozer', user.name);
                                user.stats.multiplayer.incorrect++;
                            }

                            user.games = [];
                            await user.save();
                        }

                        Server.brodcast(JSON.stringify({
                            header: 'END_GAME',
                            data: {
                                winner: game.winner,
                                word: game.word,
                            }
                        }), client => client.user?.name === game.players.find(player => player !== user.name));
                    });
            } else {
                user.stats.singleplayer.correct++;

                game.save();
                user.save();
            }
        } else if (game.guesses[user.name].length === 6) {    
            data.finished = true;
            data.failed = true;

            if (game.type === 'singleplayer') {
                data.word = game.word;
                game.active = false;
                game.winner = 'Nobody';

                user.games = [];
                user.stats.singleplayer.incorrect++;

                game.markModified('guesses');
                game.markModified('results');
                game.markModified('usedHint');

                game.save();
                user.save();
            } else if (game.type === 'multiplayer') {
                if (game.winner.includes('Not')) {
                    game.active = false;
                    data.word = game.word;
                    game.winner = 'Nobody';

                    game.markModified('guesses');
                    game.markModified('results');
                    game.markModified('usedHint');
    
                    game.save()
                        .then(async () => {
                            const players = [...Server.clients].filter(client => game.players.includes(client.user?.name));
    
                            for (let player of players) {
                                const user = await Users.findOne({ name: player.user.name });

                                user.stats.multiplayer.incorrect++;
                                user.games = [];
                                await user.save();
                            }

                            Server.brodcast(JSON.stringify({
                                header: 'END_GAME',
                                data: {
                                    winner: game.winner,
                                    word: game.word,
                                }
                            }), client => game.players.includes(client.user?.name));
                        });
                } else {
                    game.winner = `Not ${user.name}`;

                    game.markModified('guesses');
                    game.markModified('results');
                    game.markModified('usedHint');

                    game.save().catch(console.error);
                    user.save().catch(console.error);
                }
            }
        } else {
            game.markModified('guesses');
            game.markModified('results');
            game.markModified('usedHint');
            game.save()
                .then(() => {
                    user.save()
                        .catch(error => {
                            console.error(error);
    
                            response.status(500).json({
                                status: 'ERROR',
                                data: { message: 'An internal error occured when starting a game. Please retry later.', dev_error: error, },
                            });
                        });
                })
                .catch(error => {
                    console.error(error);
    
                    response.status(500).json({
                        status: 'ERROR',
                        data: { message: 'An internal error occured when starting a game. Please retry later.', dev_error: error, },
                    });
                });
        }

        response.json({ status: 'SUCCESS', data, });
    });

module.exports = { GameRouter };