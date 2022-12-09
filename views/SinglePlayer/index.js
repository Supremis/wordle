class TileEditor {
    constructor() {
        this.current = 'g-1-1';
        this.results = [];
        this.hints = {
            letter: null,
            position: null,
        };
        this.word = null;

        document.getElementById(this.current).classList.add('current');
    }

    alert(type, message) {
        switch (type) {
            case 'warning': {
                $('#alert_placeholder').html(`<div class="alert alert-warning alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>`)

                $("#alert_placeholder").fadeTo(2000, 500).slideUp(500, () => {
                    $("#alert_placeholder").slideUp(500);
                });
                break;
            }
            case 'wrong': {
                $('#alert_placeholder').html(`<div class="alert alert-danger alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>`);

                $("#alert_placeholder").fadeTo(2000, 500).slideUp(500, () => {
                    $("#alert_placeholder").slideUp(500);
                });
                break;
            }
            case 'correct': {
                $('#alert_placeholder').html(`<div class="alert alert-success alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>`);

                $("#alert_placeholder").fadeTo(2000, 500).slideUp(500, () => {
                    $("#alert_placeholder").slideUp(500);
                });
                break;
            }
        }
    }

    _move(type) {
        for (let i = 1; i < 6; i++) {
            document.getElementById(`g-${this.current.split('-')[1]}-${i}`).style.backgroundColor = null;
        }

        switch (type) {
            case 'forward': {
                let [name, row, column] = this.current.split('-');
                if (column < 5) column++;

                this.current = `${name}-${row}-${column}`;
                break;
            }
            case 'backward': {
                let [name, row, column] = this.current.split('-');
                if (column > 1) column--;

                this.current = `${name}-${row}-${column}`;
                break;
            }
        }
    } 

    copyBoard() {
        let copiedText = `Look at how I did when attempting a Wordle${this.word ? ` for the word: ||${this.word}||` : ''}!\n`;


        this.results.forEach(result => {
            result.split('').forEach(letter => {
                copiedText += letter == 'c' ? '🟩' : (letter == 'p' ? '🟨' : '⬛');
            });
            copiedText += `\n`;
        });

        window.navigator.clipboard.writeText(copiedText);
    }

    loadGame({ guesses, results }) {
        guesses.player.forEach((guess, index) => {
            guess.split('').forEach(letter => { this.type(letter) });
            this.handle({
                result: results.player[index],
                finished: false,
            });
        });
    }

    type(letter) {
        document.getElementById(this.current).value = letter;
        for (let i = 1; i < 6; i++) {
            document.getElementById(`g-${this.current.split('-')[1]}-${i}`).style.backgroundColor = null;
        }

        this._move('forward');
    }

    backspace() {
        if (document.getElementById(this.current).value == '') {
            this._move('backward');
            document.getElementById(this.current).value = '';
        } else {
            document.getElementById(this.current).value = '';
            this._move('backward');
        }
    }
    
    getWord() {
        let word = '';
        const row = this.current.split('-')[1];

        for (let i = 1; i < 6; i++) {
            if (!document.getElementById(`g-${row}-${i}`).value) {
                this.alert('warning', 'The row is incomplete.');
                break;
            }

            word += document.getElementById(`g-${row}-${i}`).value;
        }

        return word;
    }

    next() {
        const row = this.current.split('-')[1];
        this.current = `g-${parseInt(row) + 1}-1`;
    }

    reset() {
        this.results = [];
        this.current = 'g-1-1';

        for (let r = 1; r < 7; r++) {
            for (let c = 1; c < 6; c++) {
                document.getElementById(`g-${r}-${c}`).value = null;
                document.getElementById(`g-${r}-${c}`).style.backgroundColor = null;
            }
        }

        fetch('http://localhost:3000/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ id: localStorage.id, type: 'singleplayer' }),
        });
    }

    handle(data) {
        const { result, finished, word, failed } = data;
        this.results.push(result);
        result.split('').forEach((letter, index) => {
            index++;
            document.getElementById(`g-${this.current.split('-')[1]}-${index}`).style.backgroundColor = letter == 'c' ? '#6aaa64' : (letter == 'p' ? '#c9b458' : '#86888a');
        });

        if (finished) {
            this.word = word;

            this.alert(failed ? 'wrong' : 'correct', `The game has ended. The word was: ${word}.`);
            getStats(true);
        } else {
            this.next();
        }
    }

    hint(letter = this.hints.letter, position = this.hints.position) {
        const row = this.current.split('-')[1];

        this.current = `g-${row}-${position + 1}`;
        document.getElementById(this.current).style.backgroundColor = '#6aaa64';
        document.getElementById(this.current).value = letter;

        this.hints = { letter, position };
        this.alert('correct', 'A magical hint has been gifted to you! Use it wisely.');
    }
}

const _TileSystem = new TileEditor();
const TileSystem = new Proxy(_TileSystem, {
    set(target, key, value) {
        if (key === 'current') {
            const oldValue = target[key];
            document.getElementById(oldValue).classList.remove('current');
            document.getElementById(value).classList.add('current');
        }

        target[key] = value;
        return true;
    }
}); 

window.onload = () => {
    if (localStorage.darkMode) { 
        document.body.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        document.querySelectorAll('.modal-content').forEach(element => { element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; element.style.color = '#FFFFFF'; });

        document.querySelector('body').style.color = '#FFFFFF';
    }
};

const triggerEvent = (type) => {
    switch (type) {
        case 'darkMode': {
            if (localStorage.darkMode) {
                delete localStorage.darkMode;
                document.body.style.backgroundColor = '#FFFFFF';
                document.querySelectorAll('.modal-content').forEach(element => { element.style.backgroundColor = '#FFFFFF'; element.style.color = '#000000'; });

                document.querySelectorAll('h1').forEach(element => element.style.color = '#000000');
                document.querySelectorAll('button').forEach(element => element.style.color = '#000000');
            } else {
                localStorage.darkMode = true;
                document.body.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                document.querySelectorAll('.modal-content').forEach(element => { element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; element.style.color = '#FFFFFF'; });
        
                document.querySelector('body').style.color = '#FFFFFF';
            }
            break;
        }
    }
};

const getHints = async () => {
    event?.target?.blur();
    
    if (!TileSystem.hints.letter) {
        const hint = await fetch('http://localhost:3000/game/hint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: localStorage.id }),
        }).then(r => r.json());
    
        if (hint.status === 'ERROR') TileSystem.alert('wrong', hint.data.message);
        else {
            const { letter, position } = hint.data.hint;
            TileSystem.hint(letter, position);
        }
    } else {
        TileSystem.hint();
    }
};

const getOptions = () => {
    event?.target?.blur();

    document.querySelector('.options-modal-body').innerHTML = `
    <label for="screenshots" id="screenshots_label">
        Dark Mode
    </label> 
    <input type="checkbox" onclick="triggerEvent('darkMode')" id="screenshots" ${localStorage.darkMode ? 'checked': ''}>`;

    $('#options-modal').modal();
};

const getStats = async (finishedGame) => {
    event?.target?.blur();

    const stats = await fetch('http://localhost:3000/user/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: localStorage.id, type: 'singleplayer' }),
    }).then(r => r.json());

    document.querySelector('.modal-body').innerHTML = `
        <p style="color: green;">Correct: ${stats.correct}</p>
        <p style="color: red;">Incorrect: ${stats.incorrect}</p>
        <p>Win Percentage: ${stats.win_percentage}</p>`;

    if (finishedGame && document.querySelector('.modal-footer').children.length !== 3) {
        document.querySelector('.modal-footer').innerHTML += `
        <button type="button" class="btn btn-primary" data-dismiss="modal" onclick="TileSystem.reset();">Restart</button>
        <button type="button" class="btn btn-primary" onclick="TileSystem.copyBoard();">Export as Unicode</button>
        `;
    }
    $('#modal').modal();
};

(async () => {
    if (!localStorage.id) {
        window.location.href = '/';
    }
    
    const prevGame = await fetch('http://localhost:3000/game/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: localStorage.id, type: 'singleplayer' }),
    }).then(r => r.json());

    if (prevGame.data.guesses.player.length) {
        TileSystem.loadGame(prevGame.data);
    } else {
        fetch('http://localhost:3000/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ id: localStorage.id, type: 'singleplayer' }),
        });
    }

    document.addEventListener('keydown', async function(event) {
        if (event.keyCode == 8) {
            TileSystem.backspace();
        } else if (event.keyCode == 13) {
            const guess = TileSystem.getWord().toLowerCase();
            if (guess.length !== 5) return;
            
            const result = await fetch('http://localhost:3000/game/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: localStorage.id, guess, }),
            }).then(r => r.json());

            if (result.status == 'ERROR') {
                TileSystem.alert('warning', result.data.message);
            } else {
                TileSystem.handle(result.data);
            }
        } else if (event.keyCode >= 65 && event.keyCode <= 90) {
            TileSystem.type(event.key);
        } 
    });
})();