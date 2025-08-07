const boardElement = document.getElementById('board');
const currentPlayerElement = document.getElementById('current-player');
const gameStatusElement = document.getElementById('game-status');
const redScoreElement = document.getElementById('red-score');
const yellowScoreElement = document.getElementById('yellow-score');
const timerElement = document.getElementById('timer');
const resetButton = document.getElementById('reset-button');
const undoButton = document.getElementById('undo-button');
const aiButton = document.getElementById('ai-button');
const aiDifficultySelect = document.getElementById('ai-difficulty');
const boardSizeSelect = document.getElementById('board-size');
const timerLimitSelect = document.getElementById('timer-limit');
const redColorPicker = document.getElementById('red-color');
const yellowColorPicker = document.getElementById('yellow-color');
const gameLogElement = document.getElementById('game-log');
const dropSound = document.getElementById('drop-sound');
const winSound = document.getElementById('win-sound');

let ROWS = 6;
let COLS = 7;
let board = [];
let currentPlayer = 'red';
let gameActive = true;
let isAIActive = false;
let scores = JSON.parse(localStorage.getItem('connect4Scores')) || { red: 0, yellow: 0 };
let moveHistory = [];
let timerInterval;
let timeLeft = parseInt(timerLimitSelect.value);
let gameCount = 0;

function initializeBoard() {
    board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', () => handleCellClick(col));
            boardElement.appendChild(cell);
        }
    }
    updateScore();
    updateColors();
    startTimer();
}

async function handleCellClick(col) {
    if (!gameActive) return;

    const row = getLowestEmptyRow(col);
    if (row === -1) return;

    moveHistory.push({ row, col, player: currentPlayer });
    undoButton.disabled = false;

    board[row][col] = currentPlayer;
    await updateCell(row, col);
    dropSound.play();

    addLog(`Player ${currentPlayer.toUpperCase()} placed in column ${col + 1}`);

    const winCells = checkWin(row, col);
    if (winCells) {
        highlightWinningLine(winCells);
        gameStatusElement.textContent = `${currentPlayer.toUpperCase()} wins!`;
        scores[currentPlayer]++;
        localStorage.setItem('connect4Scores', JSON.stringify(scores));
        updateScore();
        winSound.play();
        gameActive = false;
        undoButton.disabled = true;
        addLog(`Game ${gameCount}: ${currentPlayer.toUpperCase()} wins!`);
        clearInterval(timerInterval);
        return;
    }
    if (checkDraw()) {
        gameStatusElement.textContent = "It's a draw!";
        gameActive = false;
        undoButton.disabled = true;
        addLog(`Game ${gameCount}: Draw!`);
        clearInterval(timerInterval);
        return;
    }

    currentPlayer = currentPlayer === 'red' ? 'yellow' : 'red';
    currentPlayerElement.textContent = currentPlayer;
    currentPlayerElement.style.color = getComputedStyle(document.documentElement).getPropertyValue(`--${currentPlayer}-color`);
    resetTimer();

    if (isAIActive && currentPlayer === 'yellow' && gameActive) {
        undoButton.disabled = true;
        setTimeout(makeAIMove, 500);
    }
}

function getLowestEmptyRow(col) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (!board[row][col]) return row;
    }
    return -1;
}

async function updateCell(row, col) {
    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    cell.classList.add('drop-animation', currentPlayer);
    await new Promise(resolve => setTimeout(resolve, 500));
    cell.classList.remove('drop-animation');
}

function checkWin(row, col) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
        let count = 1;
        const cells = [{ row, col }];
        for (let i = 1; i <= 3; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === currentPlayer) {
                count++;
                cells.push({ row: r, col: c });
            } else {
                break;
            }
        }
        for (let i = 1; i <= 3; i++) {
            const r = row - dr * i;
            const c = col - dc * i;
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === currentPlayer) {
                count++;
                cells.push({ row: r, col: c });
            } else {
                break;
            }
        }
        if (count >= 4) return cells;
    }
    return null;
}

function highlightWinningLine(cells) {
    cells.forEach(({ row, col }) => {
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        cell.classList.add('winning');
    });
}

function checkDraw() {
    return board.every(row => row.every(cell => cell !== null));
}

function updateScore() {
    redScoreElement.textContent = scores.red;
    yellowScoreElement.textContent = scores.yellow;
}

function updateColors() {
    document.documentElement.style.setProperty('--red-color', redColorPicker.value);
    document.documentElement.style.setProperty('--yellow-color', yellowColorPicker.value);
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = parseInt(timerLimitSelect.value);
    timerElement.textContent = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        if (timeLeft <= 0 && gameActive) {
            gameStatusElement.textContent = `${currentPlayer.toUpperCase()} ran out of time! ${currentPlayer === 'red' ? 'Yellow' : 'Red'} wins!`;
            scores[currentPlayer === 'red' ? 'yellow' : 'red']++;
            localStorage.setItem('connect4Scores', JSON.stringify(scores));
            updateScore();
            gameActive = false;
            undoButton.disabled = true;
            addLog(`Game ${gameCount}: ${currentPlayer === 'red' ? 'Yellow' : 'Red'} wins due to timeout!`);
            clearInterval(timerInterval);
            winSound.play();
        }
    }, 1000);
}

function resetTimer() {
    timeLeft = parseInt(timerLimitSelect.value);
    timerElement.textContent = timeLeft;
}

function addLog(message) {
    const li = document.createElement('li');
    li.textContent = message;
    gameLogElement.appendChild(li);
    gameLogElement.scrollTop = gameLogElement.scrollHeight;
}

function makeAIMove() {
    const difficulty = aiDifficultySelect.value;
    let col;
    if (difficulty === 'easy') {
        const validCols = [];
        for (let c = 0; c < COLS; c++) {
            if (getLowestEmptyRow(c) !== -1) validCols.push(c);
        }
        col = validCols[Math.floor(Math.random() * validCols.length)];
    } else {
        const depth = difficulty === 'medium' ? 4 : 6;
        col = minimax(depth, true, -Infinity, Infinity).col;
    }
    if (col !== undefined) {
        moveHistory.push({ col, player: 'yellow' });
        handleCellClick(col);
    }
}

function minimax(depth, isMaximizing, alpha, beta) {
    const validCols = [];
    for (let c = 0; c < COLS; c++) {
        if (getLowestEmptyRow(c) !== -1) validCols.push(c);
    }

    if (depth === 0 || validCols.length === 0 || checkWinCondition()) {
        return { score: evaluateBoard() };
    }

    if (isMaximizing) {
        let best = { score: -Infinity, col: null };
        for (const col of validCols) {
            const row = getLowestEmptyRow(col);
            board[row][col] = 'yellow';
            const score = minimax(depth - 1, false, alpha, beta).score;
            board[row][col] = null;
            if (score > best.score) {
                best.score = score;
                best.col = col;
            }
            alpha = Math.max(alpha, best.score);
            if (beta <= alpha) break;
        }
        return best;
    } else {
        let best = { score: Infinity, col: null };
        for (const col of validCols) {
            const row = getLowestEmptyRow(col);
            board[row][col] = 'red';
            const score = minimax(depth - 1, true, alpha, beta).score;
            board[row][col] = null;
            if (score < best.score) {
                best.score = score;
                best.col = col;
            }
            beta = Math.min(beta, best.score);
            if (beta <= alpha) break;
        }
        return best;
    }
}

function evaluateBoard() {
    let score = 0;
    // Center preference
    const centerCol = Math.floor(COLS / 2);
    for (let row = 0; row < ROWS; row++) {
        if (board[row][centerCol] === 'yellow') score += 3;
        if (board[row][centerCol] === 'red') score -= 3;
    }
    // Check all positions
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) {
                score += evaluatePosition(row, col, board[row][col]);
            }
        }
    }
    return score;
}

function evaluatePosition(row, col, player) {
    let score = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
        let count = 0;
        let empty = 0;
        let blocked = 0;
        for (let i = -3; i <= 3; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                if (board[r][c] === player) count++;
                else if (!board[r][c]) empty++;
                else blocked++;
            }
        }
        if (count >= 4) score += 10000;
        else if (count === 3 && empty >= 1 && blocked === 0) score += 1000;
        else if (count === 2 && empty >= 2 && blocked === 0) score += 100;
        else if (count === 1 && empty >= 3 && blocked === 0) score += 10;
    }
    return player === 'yellow' ? score : -score;
}

function checkWinCondition() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col] && checkWin(row, col)) return true;
        }
    }
    return false;
}

function undoMove() {
    if (!gameActive || moveHistory.length === 0) return;

    const lastMove = moveHistory.pop();
    const { row, col, player } = lastMove;
    board[row][col] = null;
    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    cell.classList.remove(player, 'winning');
    
    currentPlayer = player;
    currentPlayerElement.textContent = currentPlayer;
    currentPlayerElement.style.color = getComputedStyle(document.documentElement).getPropertyValue(`--${currentPlayer}-color`);
    gameStatusElement.textContent = 'Game in progress';
    gameActive = true;
    
    undoButton.disabled = moveHistory.length === 0;
    resetTimer();
    addLog(`Undo: Player ${player.toUpperCase()} removed move from column ${col + 1}`);
    if (isAIActive && currentPlayer === 'yellow') {
        undoMove(); // Undo AI's move
    }
}

function resetGame() {
    gameCount++;
    addLog(`--- Game ${gameCount} Started ---`);
    initializeBoard();
    currentPlayer = 'red';
    currentPlayerElement.textContent = 'Red';
    currentPlayerElement.style.color = getComputedStyle(document.documentElement).getPropertyValue('--red-color');
    gameStatusElement.textContent = 'Game in progress';
    gameActive = true;
    moveHistory = [];
    undoButton.disabled = true;
}

boardSizeSelect.addEventListener('change', () => {
    const [rows, cols] = boardSizeSelect.value.split('x').map(Number);
    ROWS = rows;
    COLS = cols;
    resetGame();
});

timerLimitSelect.addEventListener('change', resetTimer);

redColorPicker.addEventListener('input', updateColors);
yellowColorPicker.addEventListener('input', updateColors);

resetButton.addEventListener('click', resetGame);
undoButton.addEventListener('click', undoMove);
aiButton.addEventListener('click', () => {
    isAIActive = !isAIActive;
    aiButton.textContent = isAIActive ? 'Play Against Human' : 'Play Against AI';
    resetGame();
    if (isAIActive && currentPlayer === 'yellow') {
        makeAIMove();
    }
});

initializeBoard();
addLog('--- Game 1 Started ---');