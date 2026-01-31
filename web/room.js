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
    bankroll: 1000,
    currentBet: 0,

    reset() {
        this.roomCode = null;
        this.playerId = generatePlayerId();
        this.playerName = null;
        this.isHost = false;
        this.players = [];
        this.isReady = false;
        this.gameState = null;
        this.bankroll = 1000;
        this.currentBet = 0;
    }
};

// ============================================================================
// SUPABASE INITIALIZATION
// ============================================================================

function initSupabase() {
    if (supabaseClient) return true;

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
        bankroll: RoomState.bankroll,
        hand: RoomState.gameState?.playerHands?.[RoomState.playerId] || null,
        status: RoomState.gameState?.playerStatuses?.[RoomState.playerId] || 'waiting'
    });
}

async function broadcastGameState(state) {
    if (!roomChannel) return;

    console.log('Broadcasting game state', state);
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

    // 1. Initialize Bankrolls from current state or default
    const previousBankrolls = RoomState.gameState?.playerBankrolls || {};
    const playerBankrolls = {};
    const bets = {};

    RoomState.players.forEach(p => {
        // Use synced bankroll from presence or previous game
        playerBankrolls[p.id] = p.bankroll || 1000;
        bets[p.id] = 0;
    });

    // 2. Start Betting Phase
    const gameState = {
        phase: 'betting',
        playerBankrolls,
        bets,
        playerHands: {},
        playerStatuses: {},
        dealerHand: { cards: [], value: 0 },
        shoeCards: [] // Will init later
    };

    RoomState.gameState = gameState;
    await broadcastGameState(gameState);

    // UI update handled by broadcast receiver
    showScreen('multiplayer-game');
    renderMultiplayerGame();
}

function dealMultiplayerRound(state) {
    if (!RoomState.isHost) return;

    // Create Shoe & Deal
    const shoe = new Shoe(0.75);
    const dealerHand = new Hand();
    const playerHands = {};
    const playerStatuses = {};

    // Deal 2 cards
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

    dealerHand.addCard(shoe.deal());
    dealerHand.addCard(shoe.deal());

    state.phase = 'playing';
    state.currentPlayerIndex = 0;
    state.currentPlayerId = RoomState.players[0].id;
    state.playerHands = playerHands;
    state.playerStatuses = playerStatuses; // Keep bankrolls/bets
    state.dealerHand = {
        cards: dealerHand.cards.map(c => ({ rank: c.rank, suit: c.suit })),
        value: dealerHand.value,
        showHoleCard: false
    };
    state.shoeCards = shoe.deck.cards.map(c => ({ rank: c.rank, suit: c.suit }));

    broadcastGameState(state);
    renderMultiplayerGame();
}


function handleGameStateUpdate(state) {
    console.log('Received game state update', state);
    RoomState.gameState = state;

    if (state.phase === 'playing' || state.phase === 'betting') {
        console.log('Switching to game screen for phase:', state.phase);
        showScreen('multiplayer-game');
    }

    renderMultiplayerGame();
}

function handlePlayerAction({ playerId, action, data }) {
    console.log('Handling player action', { playerId, action, data });
    if (!RoomState.isHost) return;

    // Host processes action and broadcasts new state
    const state = RoomState.gameState;

    // Betting Phase Exception
    if (action === 'bet') {
        if (state.phase !== 'betting') return;
        state.bets[playerId] = data.amount;

        const allBet = RoomState.players.every(p => state.bets[p.id] > 0);
        if (allBet) {
            dealMultiplayerRound(state);
        } else {
            broadcastGameState(state);
            renderMultiplayerGame();
        }
        return;
    }

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
            // Double the bet
            state.bets[playerId] = (state.bets[playerId] || 0) * 2;

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
        const bet = state.bets[playerId] || 0;
        let payout = 0;

        if (status === 'surrendered') {
            playerHand.result = 'surrendered';
            payout = bet * 0.5;
        } else if (status === 'busted') {
            playerHand.result = 'lose';
            payout = 0;
        } else if (playerHand.isBlackjack && !state.dealerHand.isBlackjack) {
            playerHand.result = 'blackjack';
            payout = bet * 2.5;
        } else if (dealerBusted) {
            playerHand.result = 'win';
            payout = bet * 2;
        } else if (playerHand.value > dealerValue) {
            playerHand.result = 'win';
            payout = bet * 2;
        } else if (playerHand.value < dealerValue) {
            playerHand.result = 'lose';
            payout = 0;
        } else {
            playerHand.result = 'push';
            payout = bet;
        }

        // Update bankroll (bankrolls already had bets not deducted?? No, we didn't deduct yet)
        // Let's assume bankrolls in state are 'start of round'. 
        // So we subtract bet and add payout.
        state.playerBankrolls[playerId] = (state.playerBankrolls[playerId] || 1000) - bet + payout;
    });
}

// ============================================================================
// MULTIPLAYER UI RENDERING
// ============================================================================

function renderMultiplayerGame() {
    const state = RoomState.gameState;
    if (!state) return;

    // BETTING UI
    // BETTING UI
    const bettingArea = document.getElementById('mp-betting-area');
    const myBet = state.bets[RoomState.playerId] || 0;

    if (state.phase === 'betting') {
        const myBankroll = state.playerBankrolls[RoomState.playerId] || 1000;
        RoomState.bankroll = myBankroll; // Sync local bankroll
        document.getElementById('mp-my-bankroll').textContent = myBankroll;

        if (myBet > 0) {
            // Already bet, waiting for others
            bettingArea.style.display = 'none';
            const statusEl = document.getElementById('mp-game-status');
            const betCount = Object.values(state.bets).filter(b => b > 0).length;
            statusEl.textContent = `Bet Placed: $${myBet}. Waiting for others (${betCount}/${RoomState.players.length})...`;
        } else {
            // Need to bet
            bettingArea.style.display = 'flex';
            document.getElementById('mp-my-bet').textContent = RoomState.currentBet;

            const statusEl = document.getElementById('mp-game-status');
            const betCount = Object.values(state.bets).filter(b => b > 0).length;
            statusEl.textContent = `Betting Phase: ${betCount}/${RoomState.players.length} players ready`;
        }
        return; // Don't render hands yet
    } else {
        bettingArea.style.display = 'none';

        // Update local bankroll from state result
        if (state.phase === 'results') {
            RoomState.bankroll = state.playerBankrolls[RoomState.playerId];
            document.getElementById('mp-my-bankroll').textContent = RoomState.bankroll;
            updatePresence(); // Sync to lobby
        } else {
            // Update bankroll display during other phases too
            document.getElementById('mp-my-bankroll').textContent = state.playerBankrolls[RoomState.playerId];
        }
    }

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
            ${state.phase === 'playing' || state.phase === 'results' ? `<div class="mp-player-bankroll">$${state.playerBankrolls[player.id]} (Bet: $${state.bets[player.id]})</div>` : ''}
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
        if (RoomState.isHost) {
            statusEl.innerHTML = 'Round Complete! <button class="btn btn-primary btn-small" onclick="startMultiplayerGame()" style="margin-left:10px; padding: 2px 8px; font-size: 0.8rem;">Next Deal</button>';
        } else {
            statusEl.textContent = 'Round Complete! Waiting for host...';
        }
    } else if (state.phase === 'dealer') {
        statusEl.textContent = 'Dealer\'s Turn';
    } else {
        const currentPlayer = RoomState.players.find(p => p.id === state.currentPlayerId);
        statusEl.textContent = currentPlayer ? `${currentPlayer.name}'s Turn` : 'Waiting...';
    }

    // Update turn indicator
    if (state.phase === 'results') {
        document.getElementById('mp-turn-indicator').textContent = 'Round Over';
    } else {
        document.getElementById('mp-turn-indicator').textContent = isYourTurn ? 'Your Turn!' : 'Waiting...';
    }

    // Also render bankrolls in hand view
    RoomState.players.forEach(p => {
        // Find element
        // This is sloppy since handEl is regen every time.
        // We should add bankroll to hand HTML in render loop.
    });
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

// Helper functions for UI
function mpSelectBet(amount) {
    if (amount === -1) {
        RoomState.currentBet = 0;
    } else {
        if (RoomState.currentBet + amount <= RoomState.bankroll) {
            RoomState.currentBet += amount;
        }
    }
    renderMultiplayerGame();
}

async function mpConfirmBet() {
    if (RoomState.currentBet <= 0) {
        showToast('!', 'Place a bet first');
        return;
    }

    // Disable buttons
    // document.querySelector('#mp-betting-overlay .action-buttons').style.display = 'none'; // REMOVED
    showToast('✓', 'Bet Placed. Waiting for others...');

    await broadcastAction('bet', { amount: RoomState.currentBet });

    // If we're not connected to Supabase, handle locally
    if (!roomChannel) {
        handlePlayerAction({ playerId: RoomState.playerId, action: 'bet', data: { amount: RoomState.currentBet } });
    }

    // Host will process logic
}

window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.toggleReady = toggleReady;
window.copyRoomCode = copyRoomCode;
window.leaveRoom = leaveRoom;
window.startMultiplayerGame = startMultiplayerGame;
window.mpPlayerAction = mpPlayerAction;
window.mpSelectBet = mpSelectBet;
window.mpConfirmBet = mpConfirmBet;
window.RoomState = RoomState;
