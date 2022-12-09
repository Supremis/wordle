const WebSocket = require('ws');
const { Users, Games } = require('./database/Models');
const { server } = require('./Express');

const Server = new WebSocket.Server({ server, });

Server.brodcast = function(message, filter) {
    if (typeof message !== 'string') throw new TypeError('Parameter message is not of type String.');
    const clients = [...this.clients].filter(filter);

    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    });
    return clients;
}

Server.on('listening', () => { console.log('WebSocket server is online.') });

Server.on('connection', function(socket) {
    socket.addEventListener('message', async function({ data }) {
        try {
            data = JSON.parse(data);
            if (!data) throw 'no botting.';
            if (!Object.hasOwn(data, 'header')) throw 'no botting.';
        } catch (error) {
            socket.send('no botting.');
            socket.close();
        }
        
        switch (data.header) {
            case 'AUTHORIZE': {
                if (!data?.data?.id) return socket.close(); // no botting.
        
                const { id } = data.data;

                const user = await Users.findOne({ id });
                if (!user) return socket.send(JSON.stringify({ header: 'ERROR', data: { message: 'Invalid ID.' } }));

                socket.user = user;
                socket.send(JSON.stringify({ header: 'VERIFIED', }));
            }
        }
    });

    socket.addEventListener('close', async function() {
        if (!socket.user) return;
        
        const user = await Users.findOne({ id: socket.user.id });
        if (user?.games) {
            const game = await Games.findOne({ id: user.games[0] });
            if (!game) return;
            
            if (game.type !== 'multiplayer') return;
            if (game.players.length === 1) { 
                Games.findOneAndDelete({ id: user.games[0] })
                    .then(() => {
                        user.games = [];
                        user.save();
                    });
            } else {
                setTimeout(() => {
                    // disqualify player, emit WIN event to winner
                }, 3e4);
            }
        }
    });
});

Server.on('close', function() { console.log('WebSocket server has closed prematurely.') });
Server.on('error', function(err) { console.error('WebSocket server has closed prematurely due to err.', err) });

module.exports = { Server };