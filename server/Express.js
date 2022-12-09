require('dotenv').config();

const Express = require('express');
const app = Express();

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connection to MongoDB has been established.'))
    .catch(error => console.error('Could not connect to MongoDB:', error));

const server = app.listen(process.env.PORT || 3000, function() {
    console.log(`Wordle Server is listening on port ${process.env.PORT || 3000}!`);
});

module.exports = { server };

const { Users } = require('./database/Models');
const { GameRouter } = require('./routes/Game.js');

app.use(Express.json());
app.use(Express.static(`${__dirname.replace('\\server', '')}\\views`));
app.use('/game', GameRouter);

app.get('/', (_request, response) => {
    response.sendFile('\\Menu\\index.html', { root: `${__dirname.replace('\\server', '')}\\views` });
});

app.get('/singleplayer', (_request, response) => {
    response.sendFile('\\SinglePlayer\\index.html', { root: `${__dirname.replace('\\server', '')}\\views` });
});

app.get('/multiplayer', (_request, response) => {
    response.sendFile('\\MultiPlayer\\index.html', { root: `${__dirname.replace('\\server', '')}\\views` });
});

app.post('/init-session', async (request, response) => {
    // Anti-botting system will occur later.
    const { name } = request.body;
    if (typeof name !== 'string') return response.send('no botting.');
    if (name.length < 1 || name.length > 16) return response.status(400).json({ status: 'ERROR', data: { message: 'Please keep your name in between 1-16 characters.' } });

    const u = await Users.findOne({ name, });
    if (u) return response.status(400).send({ status: 'ERROR', data: { message: 'Username is taken.' } });

    const id = require('crypto').randomBytes(64).toString('hex');
    const user = new Users({
        id,
        name,
        stats: {
            singleplayer: {
                correct: 0,
                incorrect: 0,
            },
            multiplayer: {
                correct: 0,
                incorrect: 0,
            }
        },
        games: [],
    });

    user.save()
        .then(() => {
            response.json({
                status: 'SUCCESS',
                data: { id },
            });
        })
        .catch(error => {
            response.status(500).json({
                status: 'ERROR',
                data: { message: 'An internal error occured when verifying your identity. Please retry later.', dev_error: error, },
            });
        });
});

app.post('/user/stats', async (request, response) => {
    const users = await Users.find();
    const { id, type } = request.body;

    if (typeof id != 'string') return response.send('no botting.');
    if (!['singleplayer', 'multiplayer'].includes(type)) return response.send('no botting.');

    const user = users.find(user => user.id === id);
    if (!user) return response.status(401).json({ status: 'ERROR', data: { message: 'Invalid ID.' } });

    let correct = user.stats[type].correct, incorrect = user.stats[type].incorrect;
    let win_percentage;

    if (correct == 0)  {
        win_percentage = '0%';
    } else if (incorrect == 0) {
        win_percentage = correct == 0 ? '0%' : '100%';
    } else {
        win_percentage = `${Math.round((correct / (correct + incorrect)) * 100)}%`;
    }

    response.json({
        correct,
        incorrect,
        win_percentage,
    });
});