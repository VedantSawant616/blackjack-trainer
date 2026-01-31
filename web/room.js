/**
 * room.js - Multiplayer room management with Supabase Realtime
 * Handles room creation, joining, player sync, and game state
 */

// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================

const SUPABASE_URL = 'https://tomlfkthcnafmlnarpdu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvbWxma3RoY25hZm1sbmFycGR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTAwOTcsImV4cCI6MjA4NTQyNjA5N30.vELrIBaefeCRXJglJDORnkIN10s3yUDMmtOt2qpwdgA';

let supabaseClient = null;
let roomChannel = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// ROOM STATE
// ============================================================================

const RoomState = {
    roomCode: null,
    playerId: generatePlayerId(),
    playerName: null,
    isHost: false,
    players: [],
    isReady: false,
    gameState: null,

    reset() {
        this.roomCode = null;
        this.playerId = generatePlayerId();
        this.playerName = null;
        this.isHost = false;
        this.players = [];
        this.isReady = false;
        this.gameState = null;
    }
};

// ============================================================================
// SUPABASE INITIALIZATION
// ============================================================================

function initSupabase() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
        console.warn('Supabase not configured. Running in offline mode.');
        return false;
    }

    // Check if Supabase SDK is loaded
    if (!window.supabase || !window.supabase.createClient) {
        console.warn('Supabase SDK not loaded. Running in offline mode.');
        return false;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized');
    return true;
}

console.log('room.js loaded successfully');

// ============================================================================
// ROOM CREATION & JOINING
// ============================================================================

async function createRoom() {
    const nameInput = document.getElementById('player-name-create');
    const playerName = nameInput.value.trim();

    if (!playerName) {
        showToast('!', 'Please enter your name');
        return;
    }

    RoomState.playerName = playerName;
    RoomState.roomCode = generateRoomCode();
    RoomState.isHost = true;
    RoomState.players = [{
        id: RoomState.playerId,
        name: playerName,
        isHost: true,
        isReady: false,
        hand: null,
        status: 'waiting'
    }];

    // Try to connect to Supabase
    if (initSupabase() && supabaseClient) {
        await subscribeToRoom(RoomState.roomCode);
        await broadcastPlayerJoin();
    }

    showLobby();
}

async function joinRoom() {
    const nameInput = document.getElementById('player-name-join');
    const codeInput = document.getElementById('room-code-input');

    const playerName = nameInput.value.trim();
    const roomCode = codeInput.value.trim().toUpperCase();

    if (!playerName) {
        showToast('!', 'Please enter your name');
        return;
    }

    if (!roomCode || roomCode.length !== 6) {
        showToast('!', 'Please enter a valid 6-character room code');
        return;
    }

    RoomState.playerName = playerName;
    RoomState.roomCode = roomCode;
    RoomState.isHost = false;

    // Try to connect to Supabase
    if (initSupabase() && supabaseClient) {
        await subscribeToRoom(roomCode);
        await broadcastPlayerJoin();
    } else {
        // Offline mode - simulate joining
        RoomState.players = [{
            id: RoomState.playerId,
            name: playerName,
            isHost: false,
            isReady: false,
            hand: null,
            status: 'waiting'
        }];
    }

    showLobby();
}

// ============================================================================
// SUPABASE REALTIME
// ============================================================================

async function subscribeToRoom(roomCode) {
    if (!supabaseClient) return;

    roomChannel = supabaseClient.channel(`room:${roomCode}`, {
        config: {
            presence: { key: RoomState.playerId },
            broadcast: { self: true }
        }
    });

    // Handle presence sync
    roomChannel.on('presence', { event: 'sync' }, () => {
        const state = roomChannel.presenceState();
        RoomState.players = Object.values(state).flat().map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost,
            isReady: p.isReady,
            hand: p.hand,
            status: p.status
        }));
        updatePlayersUI();
        checkStartConditions();
    });

    // Handle game state broadcasts
    roomChannel.on('broadcast', { event: 'game_state' }, ({ payload }) => {
        handleGameStateUpdate(payload);
    });

    // Handle player actions
    roomChannel.on('broadcast', { event: 'player_action' }, ({ payload }) => {
        handlePlayerAction(payload);
    });

    await roomChannel.subscribe();
}

async function broadcastPlayerJoin() {
    if (!roomChannel) return;

    await roomChannel.track({
        id: RoomState.playerId,
        name: RoomState.playerName,
        isHost: RoomState.isHost,
        isReady: RoomState.isReady,
        hand: null,
        status: 'waiting'
    });
}

async function updatePresence() {
    if (!roomChannel) return;

    await roomChannel.track({
        id: RoomState.playerId,
        name: RoomState.playerName,
        isHost: RoomState.isHost,
        isReady: RoomState.isReady,
        hand: RoomState.gameState?.playerHands?.[RoomState.playerId] || null,
        status: RoomState.gameState?.playerStatuses?.[RoomState.playerId] || 'waiting'
    });
}

async function broadcastGameState(state) {
    if (!roomChannel) return;

    await roomChannel.send({
        type: 'broadcast',
        event: 'game_state',
        payload: state
    });
}

async function broadcastAction(action, data) {
    if (!roomChannel) return;

    await roomChannel.send({
        type: 'broadcast',
        event: 'player_action',
        payload: { playerId: RoomState.playerId, action, data }
    });
}

// ============================================================================
// LOBBY UI
// ============================================================================

function showLobby() {
    document.getElementById('lobby-room-code').textContent = RoomState.roomCode;
    updatePlayersUI();
    showScreen('room-lobby');
}

function updatePlayersUI() {
    const container = document.getElementById('players-list');
    container.innerHTML = '';

    // If no players from Supabase, show local player
    const players = RoomState.players.length > 0 ? RoomState.players : [{
        id: RoomState.playerId,
        name: RoomState.playerName,
        isHost: RoomState.isHost,
        isReady: RoomState.isReady
    }];

    players.forEach(player => {
        const playerEl = document.createElement('div');
        playerEl.className = `player-item ${player.isReady ? 'ready' : ''} ${player.id === RoomState.playerId ? 'is-you' : ''}`;
        playerEl.innerHTML = `
            <span class="player-name">${player.name} ${player.isHost ? '(Host)' : ''} ${player.id === RoomState.playerId ? '(You)' : ''}</span>
            <span class="player-status">${player.isReady ? '✓ Ready' : 'Not Ready'}</span>
        `;
        container.appendChild(playerEl);
    });

    // Update player count
    const countInfo = document.querySelector('.lobby-container h2');
    if (countInfo) {
        countInfo.textContent = `Players: ${players.length}/6`;
    }
}

function checkStartConditions() {
    const startBtn = document.getElementById('start-game-btn');
    const readyBtn = document.getElementById('ready-btn');

    // Update ready button state
    readyBtn.textContent = RoomState.isReady ? 'Not Ready' : 'Ready';
    readyBtn.className = RoomState.isReady ? 'btn btn-outline ready-active' : 'btn btn-outline';

    // Only host can start, and needs at least 2 players, all ready
    const allReady = RoomState.players.length >= 2 && RoomState.players.every(p => p.isReady);

    if (RoomState.isHost) {
        startBtn.disabled = !allReady;
        startBtn.style.display = 'inline-block';
    } else {
        startBtn.style.display = 'none';
    }
}

async function toggleReady() {
    RoomState.isReady = !RoomState.isReady;

    // Update local player in list
    const localPlayer = RoomState.players.find(p => p.id === RoomState.playerId);
    if (localPlayer) {
        localPlayer.isReady = RoomState.isReady;
    }

    await updatePresence();
    updatePlayersUI();
    checkStartConditions();
}

function copyRoomCode() {
    navigator.clipboard.writeText(RoomState.roomCode).then(() => {
        showToast('✓', 'Room code copied!');
    });
}

async function leaveRoom() {
    if (roomChannel) {
        await roomChannel.untrack();
        await roomChannel.unsubscribe();
        roomChannel = null;
    }

    RoomState.reset();
    showScreen('mode-select');
}

// ============================================================================
// MULTIPLAYER GAME LOGIC
// ============================================================================

async function startMultiplayerGame() {
    if (!RoomState.isHost) return;

    // Create initial game state
    const shoe = new Shoe(0.75);
    const dealerHand = new Hand();
    const playerHands = {};
    const playerStatuses = {};

    // Deal 2 cards to each player
    RoomState.players.forEach(player => {
        const hand = new Hand();
        hand.addCard(shoe.deal());
        hand.addCard(shoe.deal());
        playerHands[player.id] = {
            cards: hand.cards.map(c => ({ rank: c.rank, suit: c.suit })),
            value: hand.value,
            isSoft: hand.isSoft,
            isBusted: hand.isBusted,
            isBlackjack: hand.isBlackjack
        };
        playerStatuses[player.id] = 'playing';
    });

    // Deal to dealer
    dealerHand.addCard(shoe.deal());
    dealerHand.addCard(shoe.deal());

    const gameState = {
        phase: 'playing',
        currentPlayerIndex: 0,
        currentPlayerId: RoomState.players[0].id,
        playerHands,
        playerStatuses,
        dealerHand: {
            cards: dealerHand.cards.map(c => ({ rank: c.rank, suit: c.suit })),
            value: dealerHand.value,
            showHoleCard: false
        },
        shoeCards: shoe.deck.cards.map(c => ({ rank: c.rank, suit: c.suit }))
    };

    RoomState.gameState = gameState;

    await broadcastGameState(gameState);
    showScreen('multiplayer-game');
    renderMultiplayerGame();
}

function handleGameStateUpdate(state) {
    RoomState.gameState = state;

    if (state.phase === 'playing') {
        showScreen('multiplayer-game');
    }

    renderMultiplayerGame();
}

function handlePlayerAction({ playerId, action, data }) {
    if (!RoomState.isHost) return;

    // Host processes action and broadcasts new state
    const state = RoomState.gameState;
    const playerHand = state.playerHands[playerId];

    if (!playerHand || state.playerStatuses[playerId] !== 'playing') return;

    switch (action) {
        case 'hit':
            const card = state.shoeCards.pop();
            playerHand.cards.push(card);
            // Recalculate hand value
            const hand = recreateHand(playerHand.cards);
            playerHand.value = hand.value;
            playerHand.isSoft = hand.isSoft;
            playerHand.isBusted = hand.isBusted;

            if (hand.isBusted || hand.value === 21) {
                state.playerStatuses[playerId] = hand.isBusted ? 'busted' : 'stood';
                advanceToNextPlayer(state);
            }
            break;

        case 'stand':
            state.playerStatuses[playerId] = 'stood';
            advanceToNextPlayer(state);
            break;

        case 'double':
            const dCard = state.shoeCards.pop();
            playerHand.cards.push(dCard);
            const dHand = recreateHand(playerHand.cards);
            playerHand.value = dHand.value;
            playerHand.isSoft = dHand.isSoft;
            playerHand.isBusted = dHand.isBusted;
            state.playerStatuses[playerId] = dHand.isBusted ? 'busted' : 'stood';
            advanceToNextPlayer(state);
            break;

        case 'surrender':
            state.playerStatuses[playerId] = 'surrendered';
            advanceToNextPlayer(state);
            break;
    }

    broadcastGameState(state);
    renderMultiplayerGame();
}

function advanceToNextPlayer(state) {
    const playingPlayers = RoomState.players.filter(p => state.playerStatuses[p.id] === 'playing');

    if (playingPlayers.length === 0) {
        // All players done, dealer plays
        dealerPlaysMultiplayer(state);
    } else {
        state.currentPlayerIndex++;
        state.currentPlayerId = playingPlayers[0]?.id || null;
    }
}

function dealerPlaysMultiplayer(state) {
    state.phase = 'dealer';
    state.dealerHand.showHoleCard = true;

    // Recreate dealer hand
    const dealerHand = recreateHand(state.dealerHand.cards);

    // Dealer hits until 17+
    while (dealerHand.value < 17 || (dealerHand.value === 17 && dealerHand.isSoft)) {
        const card = state.shoeCards.pop();
        dealerHand.addCard(new Card(card.rank, card.suit));
        state.dealerHand.cards.push(card);
    }

    state.dealerHand.value = dealerHand.value;
    state.dealerHand.isBusted = dealerHand.isBusted;
    state.phase = 'results';

    // Determine winners
    determineResults(state);
}

function recreateHand(cardData) {
    const hand = new Hand();
    cardData.forEach(c => hand.addCard(new Card(c.rank, c.suit)));
    return hand;
}

function determineResults(state) {
    const dealerValue = state.dealerHand.value;
    const dealerBusted = state.dealerHand.isBusted;

    Object.keys(state.playerHands).forEach(playerId => {
        const playerHand = state.playerHands[playerId];
        const status = state.playerStatuses[playerId];

        if (status === 'surrendered') {
            playerHand.result = 'surrendered';
        } else if (status === 'busted') {
            playerHand.result = 'lose';
        } else if (playerHand.isBlackjack) {
            playerHand.result = 'blackjack';
        } else if (dealerBusted) {
            playerHand.result = 'win';
        } else if (playerHand.value > dealerValue) {
            playerHand.result = 'win';
        } else if (playerHand.value < dealerValue) {
            playerHand.result = 'lose';
        } else {
            playerHand.result = 'push';
        }
    });
}

// ============================================================================
// MULTIPLAYER UI RENDERING
// ============================================================================

function renderMultiplayerGame() {
    const state = RoomState.gameState;
    if (!state) return;

    // Render dealer
    const dealerContainer = document.getElementById('mp-dealer-cards');
    dealerContainer.innerHTML = '';
    state.dealerHand.cards.forEach((cardData, i) => {
        const card = new Card(cardData.rank, cardData.suit);
        const hideHole = !state.dealerHand.showHoleCard && i === 1;
        dealerContainer.appendChild(card.toElement(hideHole));
    });

    document.getElementById('mp-dealer-value').textContent =
        state.dealerHand.showHoleCard ? state.dealerHand.value : state.dealerHand.cards[0] ? new Card(state.dealerHand.cards[0].rank, state.dealerHand.cards[0].suit).value : '';

    // Render all player hands
    const handsContainer = document.getElementById('mp-players-hands');
    handsContainer.innerHTML = '';

    RoomState.players.forEach(player => {
        const handData = state.playerHands[player.id];
        if (!handData) return;

        const isCurrentTurn = state.currentPlayerId === player.id && state.phase === 'playing';
        const isYou = player.id === RoomState.playerId;

        const handEl = document.createElement('div');
        handEl.className = `mp-player-hand ${isCurrentTurn ? 'current-turn' : ''} ${isYou ? 'is-you' : ''}`;

        const cardsHtml = handData.cards.map(c => {
            const card = new Card(c.rank, c.suit);
            return card.toElement().outerHTML;
        }).join('');

        let resultClass = '';
        if (handData.result) {
            resultClass = handData.result === 'win' || handData.result === 'blackjack' ? 'result-win' :
                handData.result === 'lose' || handData.result === 'busted' ? 'result-lose' : 'result-push';
        }

        handEl.innerHTML = `
            <div class="mp-player-name">${player.name} ${isYou ? '(You)' : ''}</div>
            <div class="mp-player-cards">${cardsHtml}</div>
            <div class="mp-player-value">${handData.value} ${handData.isSoft ? '(soft)' : ''}</div>
            ${handData.result ? `<div class="mp-player-result ${resultClass}">${handData.result.toUpperCase()}</div>` : ''}
            ${isCurrentTurn ? '<div class="turn-indicator">YOUR TURN</div>' : ''}
        `;

        handsContainer.appendChild(handEl);
    });

    // Show/hide action buttons
    const isYourTurn = state.currentPlayerId === RoomState.playerId && state.phase === 'playing';
    document.getElementById('mp-action-buttons').style.display = isYourTurn ? 'flex' : 'none';

    // Update status
    const statusEl = document.getElementById('mp-game-status');
    if (state.phase === 'results') {
        statusEl.textContent = 'Round Complete!';
    } else if (state.phase === 'dealer') {
        statusEl.textContent = 'Dealer\'s Turn';
    } else {
        const currentPlayer = RoomState.players.find(p => p.id === state.currentPlayerId);
        statusEl.textContent = currentPlayer ? `${currentPlayer.name}'s Turn` : 'Waiting...';
    }

    // Update turn indicator
    document.getElementById('mp-turn-indicator').textContent = isYourTurn ? 'Your Turn!' : 'Waiting...';
}

async function mpPlayerAction(action) {
    if (!RoomState.gameState || RoomState.gameState.currentPlayerId !== RoomState.playerId) return;

    await broadcastAction(action, {});

    // If we're not connected to Supabase, handle locally
    if (!roomChannel) {
        handlePlayerAction({ playerId: RoomState.playerId, action, data: {} });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.toggleReady = toggleReady;
window.copyRoomCode = copyRoomCode;
window.leaveRoom = leaveRoom;
window.startMultiplayerGame = startMultiplayerGame;
window.mpPlayerAction = mpPlayerAction;
window.RoomState = RoomState;
