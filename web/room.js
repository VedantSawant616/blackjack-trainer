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
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }
};

// ============================================================================
// SUPABASE INITIALIZATION
// ============================================================================

function initSupabase() {
    if (supabaseClient) return true;

    if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
        console.warn('Supabase not configured. Running in offline mode.');
        updateConnectionStatus(false);
        return false;
    }

    // Check if Supabase SDK is loaded
    if (!window.supabase || !window.supabase.createClient) {
        console.warn('Supabase SDK not loaded. Running in offline mode.');
        updateConnectionStatus(false);
        return false;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized');
    RoomState.isConnected = true;
    RoomState.reconnectAttempts = 0;
    updateConnectionStatus(true);

    // Monitor connection status
    setupConnectionMonitoring();

    return true;
}

function setupConnectionMonitoring() {
    // Listen for connectivity changes
    window.addEventListener('online', () => {
        console.log('Network online - attempting reconnect');
        attemptReconnect();
    });

    window.addEventListener('offline', () => {
        console.log('Network offline');
        RoomState.isConnected = false;
        updateConnectionStatus(false);
    });
}

async function attemptReconnect() {
    if (RoomState.isConnected || RoomState.reconnectAttempts >= RoomState.maxReconnectAttempts) {
        return;
    }

    RoomState.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, RoomState.reconnectAttempts - 1), 30000); // Max 30s

    console.log(`Reconnect attempt ${RoomState.reconnectAttempts}/${RoomState.maxReconnectAttempts} in ${delay}ms`);
    updateConnectionStatus(false, `Reconnecting... (${RoomState.reconnectAttempts}/${RoomState.maxReconnectAttempts})`);

    setTimeout(async () => {
        try {
            // Try to re-subscribe to channels
            if (RoomState.roomCode && roomChannel) {
                await roomChannel.subscribe();
                RoomState.isConnected = true;
                RoomState.reconnectAttempts = 0;
                updateConnectionStatus(true);
                showToast('✓', 'Reconnected successfully!');
            }
        } catch (error) {
            // Check if it's a room not found error
            if (error.message && error.message.includes('not found')) {
                handleError(error, 'room_not_found');
            } else {
                handleError(error, 'connection');
            }
            attemptReconnect(); // Try again
        }
    }, delay);
}

function updateConnectionStatus(isConnected, customMessage = null) {
    const statusEl = document.getElementById('connection-status');
    if (!statusEl) return;

    if (isConnected) {
        statusEl.textContent = '● Connected';
        statusEl.className = 'connection-status connected';
    } else {
        statusEl.textContent = customMessage || '● Disconnected';
        statusEl.className = 'connection-status disconnected';
    }
}

// ============================================================================
// GRACEFUL ERROR HANDLING
// ============================================================================

function handleError(error, context = 'general') {
    console.error(`Error in ${context}:`, error);

    const errorMessages = {
        'connection': {
            title: 'Connection Issue',
            message: 'Unable to connect to the game server. Please check your internet connection and try again.',
            action: 'Retry'
        },
        'room_full': {
            title: 'Room Full',
            message: 'This room has reached its player limit. Please try joining a different room.',
            action: null
        },
        'room_not_found': {
            title: 'Room Not Found',
            message: 'This room code doesn\'t exist. Please double-check the code or create a new room.',
            action: null
        },
        'invalid_action': {
            title: 'Invalid Action',
            message: 'That action isn\'t available right now. Please wait for your turn.',
            action: null
        },
        'insufficient_funds': {
            title: 'Insufficient Funds',
            message: 'You don\'t have enough chips for this action. Try a smaller bet.',
            action: null
        },
        'network': {
            title: 'Network Error',
            message: 'Lost connection to server. We\'ll try to reconnect automatically.',
            action: null
        },
        'general': {
            title: 'Something Went Wrong',
            message: 'An unexpected error occurred. Please refresh the page and try again.',
            action: 'Refresh'
        }
    };

    const errorInfo = errorMessages[context] || errorMessages['general'];

    // Show user-friendly error
    showToast('⚠️', `${errorInfo.title}: ${errorInfo.message}`);

    // Log for debugging
    if (error && error.message) {
        console.error('Error details:', error.message);
    }

    return errorInfo;
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
    try {
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
    } catch (error) {
        console.error('Join room error:', error);
        handleError(error, 'connection');
    }
}

// ============================================================================
// SUPABASE REALTIME
// ============================================================================

async function subscribeToRoom(roomCode) {
    if (!supabaseClient) {
        console.error('Cannot subscribe: Supabase client not initialized');
        showToast('⚠️', 'Connection error - Supabase not available');
        return;
    }

    console.log('=== SUBSCRIBING TO ROOM ===');
    console.log('Room code:', roomCode);
    showToast('🔌', 'Connecting to room...');

    roomChannel = supabaseClient.channel(`room:${roomCode}`, {
        config: {
            presence: { key: RoomState.playerId },
            broadcast: {
                self: false,  // Changed to false - host sends, non-hosts receive
                ack: true     // Request acknowledgment
            }
        }
    });

    console.log('Channel created, setting up listeners...');

    // Handle presence sync
    roomChannel.on('presence', { event: 'sync' }, () => {
        console.log('✓ Presence sync received');
        const presenceState = roomChannel.presenceState();
        const players = Object.values(presenceState).flat();
        RoomState.players = players;
        updatePlayersUI();
        checkStartConditions();
    });

    // Handle game state broadcasts - MORE VERBOSE LOGGING
    roomChannel.on('broadcast', { event: 'game_state' }, ({ payload }) => {
        console.log('!!! GAME STATE BROADCAST RECEIVED !!!');
        console.log('Payload:', payload);
        console.log('Event type:', 'game_state');
        showToast('📨', 'Broadcast received!');
        handleGameStateUpdate(payload);
    });

    // Handle player actions
    roomChannel.on('broadcast', { event: 'player_action' }, ({ payload }) => {
        console.log('!!! PLAYER ACTION BROADCAST RECEIVED !!!');
        handlePlayerAction(payload);
    });

    console.log('Listeners configured. Subscribing to channel...');
    const subscribeResult = await roomChannel.subscribe();
    console.log('Subscribe result:', subscribeResult);

    if (subscribeResult === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to room channel');
        showToast('✅', 'Connected!');
    } else {
        console.error('❌ Failed to subscribe:', subscribeResult);
        showToast('❌', 'Connection failed!');
    }
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
    const skeleton = document.getElementById('players-skeleton');
    container.innerHTML = '';

    // If no players from Supabase, show local player
    const players = RoomState.players.length > 0 ? RoomState.players : [{
        id: RoomState.playerId,
        name: RoomState.playerName,
        isHost: RoomState.isHost,
        isReady: RoomState.isReady
    }];

    // Hide skeleton, show actual players
    if (skeleton) skeleton.style.display = 'none';
    container.style.display = 'block';

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

    // Deal 2 cards - NOW USING ARRAY STRUCTURE FOR SPLITS
    RoomState.players.forEach(player => {
        const hand = new Hand();
        hand.addCard(shoe.deal());
        hand.addCard(shoe.deal());

        // Store as array to support splits
        playerHands[player.id] = [{
            cards: hand.cards.map(c => ({ rank: c.rank, suit: c.suit })),
            value: hand.value,
            isSoft: hand.isSoft,
            isBusted: hand.isBusted,
            isBlackjack: hand.isBlackjack,
            bet: state.bets[player.id] // Track bet per hand
        }];

        playerStatuses[player.id] = 'playing';
        state.currentHandIndex = state.currentHandIndex || {};
        state.currentHandIndex[player.id] = 0; // Start with first hand
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
    console.log('=== GAME STATE UPDATE RECEIVED ===');
    console.log('Phase:', state.phase);
    console.log('Current screen:', document.querySelector('.screen.active')?.id);
    console.log('Is Host:', RoomState.isHost);

    // Visual feedback for debugging on mobile
    if (!RoomState.isHost) {
        showToast('📡', `Game state received: ${state.phase}`);
    }

    RoomState.gameState = state;

    if (state.phase === 'playing' || state.phase === 'betting') {
        console.log('>>> ATTEMPTING SCREEN SWITCH TO multiplayer-game');
        console.log('Before switch - active screen:', document.querySelector('.screen.active')?.id);

        showScreen('multiplayer-game');

        console.log('After switch - active screen:', document.querySelector('.screen.active')?.id);
        const gameScreen = document.getElementById('multiplayer-game');
        console.log('Game screen display:', gameScreen?.style.display);
        console.log('Game screen classList:', gameScreen?.classList.toString());

        // Extra toast for non-hosts
        if (!RoomState.isHost) {
            showToast('🎮', 'Switching to game screen...');
        }
    } else {
        console.log('Phase is:', state.phase, '- not switching screen');
    }

    console.log('=== RENDERING GAME ===');
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
        state.playerBankrolls[playerId] = (state.playerBankrolls[playerId] || 1000) - data.amount;

        console.log('=== BET RECEIVED ===');
        console.log('Player:', playerId, 'bet:', data.amount);
        console.log('All bets:', state.bets);
        console.log('Players in room:', RoomState.players.map(p => p.id));

        const allBet = RoomState.players.every(p => state.bets[p.id] > 0);
        console.log('All players bet?', allBet);

        if (allBet) {
            console.log('✅ All players have bet! Starting round...');
            dealMultiplayerRound(state);
        } else {
            console.log('⏳ Waiting for more bets...');
            broadcastGameState(state);
            renderMultiplayerGame();
        }
        return;
    }

    const playerHandsArray = state.playerHands[playerId];
    if (!playerHandsArray || state.playerStatuses[playerId] !== 'playing') return;

    const handIndex = state.currentHandIndex[playerId] || 0;
    const playerHand = playerHandsArray[handIndex];

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
                advanceToNextHand(state, playerId);
            }
            break;

        case 'stand':
            advanceToNextHand(state, playerId);
            break;

        case 'double':
            // Double the bet for this hand
            const originalBet = playerHand.bet || 0;
            playerHand.bet = originalBet * 2;
            state.playerBankrolls[playerId] -= originalBet;

            const dCard = state.shoeCards.pop();
            playerHand.cards.push(dCard);
            const dHand = recreateHand(playerHand.cards);
            playerHand.value = dHand.value;
            playerHand.isSoft = dHand.isSoft;
            playerHand.isBusted = dHand.isBusted;
            advanceToNextHand(state, playerId);
            break;

        case 'split':
            // Validate: must be a pair and have enough bankroll
            if (playerHand.cards.length !== 2) break;
            const firstCard = playerHand.cards[0];
            const secondCard = playerHand.cards[1];
            if (firstCard.rank !== secondCard.rank) break;

            const splitBet = playerHand.bet;
            if (state.playerBankrolls[playerId] < splitBet) {
                console.log('Insufficient funds to split');
                break;
            }

            // Deduct split bet from bankroll
            state.playerBankrolls[playerId] -= splitBet;

            // Create second hand
            const newHand = {
                cards: [secondCard, state.shoeCards.pop()],
                bet: splitBet
            };
            const newHandObj = recreateHand(newHand.cards);
            newHand.value = newHandObj.value;
            newHand.isSoft = newHandObj.isSoft;
            newHand.isBusted = newHandObj.isBusted;
            newHand.isBlackjack = false; // Splits can't be blackjack

            // Update first hand (keep first card, deal new card)
            playerHand.cards = [firstCard, state.shoeCards.pop()];
            const firstHandObj = recreateHand(playerHand.cards);
            playerHand.value = firstHandObj.value;
            playerHand.isSoft = firstHandObj.isSoft;
            playerHand.isBusted = firstHandObj.isBusted;
            playerHand.isBlackjack = false;

            // Insert new hand after current hand
            playerHandsArray.splice(handIndex + 1, 0, newHand);
            break;

        case 'surrender':
            playerHand.result = 'surrendered';
            advanceToNextHand(state, playerId);
            break;
    }

    broadcastGameState(state);
    renderMultiplayerGame();
}


function advanceToNextHand(state, playerId) {
    const playerHandsArray = state.playerHands[playerId];
    const currentIndex = state.currentHandIndex[playerId] || 0;

    // Check if there are more hands for this player (splits)
    if (currentIndex + 1 < playerHandsArray.length) {
        // Move to next split hand
        state.currentHandIndex[playerId] = currentIndex + 1;
    } else {
        // All hands done for this player, mark as done and advance to next player
        state.playerStatuses[playerId] = 'stood';
        advanceToNextPlayer(state);
    }
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
        const playerHandsArray = state.playerHands[playerId];
        let totalPayout = 0;

        // Process each hand (for splits, there will be multiple)
        playerHandsArray.forEach(playerHand => {
            const bet = playerHand.bet || 0;
            let payout = 0;

            if (playerHand.result === 'surrendered') {
                payout = bet * 0.5;
            } else if (playerHand.isBusted) {
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

            totalPayout += payout;
        });

        // Update bankroll (bets already deducted when placed/split)
        state.playerBankrolls[playerId] = (state.playerBankrolls[playerId] || 1000) + totalPayout;
    });
}

// ============================================================================
// MULTIPLAYER UI RENDERING
// ============================================================================


function renderMultiplayerGame() {
    const state = RoomState.gameState;
    if (!state) return;

    // --- 1. BETTING UI ---
    const bettingArea = document.getElementById('mp-betting-area');
    const myBet = state.bets[RoomState.playerId] || 0;

    console.log('=== BETTING DISPLAY DEBUG ===');
    console.log('Phase:', state.phase);
    console.log('myBet from state.bets:', myBet);
    console.log('RoomState.currentBet:', RoomState.currentBet);

    if (state.phase === 'betting') {
        const myBankroll = state.playerBankrolls[RoomState.playerId] || 1000;
        RoomState.bankroll = myBankroll; // Sync local bankroll
        document.getElementById('mp-my-bankroll').textContent = myBankroll;

        if (myBet > 0) {
            // Already bet, waiting for others
            console.log('Branch: Already bet, hiding betting area');
            bettingArea.style.display = 'none';
            const statusEl = document.getElementById('mp-game-status');
            const betCount = Object.values(state.bets).filter(b => b > 0).length;
            statusEl.textContent = `Bet Placed: $${myBet}. Waiting for others (${betCount}/${RoomState.players.length})...`;
        } else {
            // Need to bet
            console.log('Branch: Need to bet, showing betting area');
            bettingArea.style.display = 'flex';
            console.log('Setting mp-my-bet textContent to:', RoomState.currentBet);
            document.getElementById('mp-my-bet').textContent = RoomState.currentBet;
            console.log('mp-my-bet element:', document.getElementById('mp-my-bet'));
            console.log('mp-my-bet textContent after update:', document.getElementById('mp-my-bet').textContent);

            const statusEl = document.getElementById('mp-game-status');
            const betCount = Object.values(state.bets).filter(b => b > 0).length;
            statusEl.textContent = `Betting Phase: ${betCount}/${RoomState.players.length} players ready`;
        }

        // Show skeleton, hide actual hands during betting
        const handsSkeleton = document.getElementById('mp-hands-skeleton');
        const handsContainer = document.getElementById('mp-players-hands');
        if (handsSkeleton) handsSkeleton.style.display = 'flex';
        if (handsContainer) handsContainer.style.display = 'none';

        document.getElementById('mp-dealer-cards').innerHTML = '';
        return;
    } else {
        bettingArea.style.display = 'none';

        // Update local bankroll
        if (state.phase === 'results') {
            RoomState.bankroll = state.playerBankrolls[RoomState.playerId];
            document.getElementById('mp-my-bankroll').textContent = RoomState.bankroll;
            updatePresence();
        } else {
            document.getElementById('mp-my-bankroll').textContent = state.playerBankrolls[RoomState.playerId];
        }
    }

    // --- 2. SMART RENDER DEALER ---
    const dealerContainer = document.getElementById('mp-dealer-cards');
    const dealerCardsData = state.dealerHand.cards.map((c, i) => ({
        ...c,
        hide: !state.dealerHand.showHoleCard && i === 1
    }));

    updateCardsContainer(dealerContainer, dealerCardsData);

    document.getElementById('mp-dealer-value').textContent =
        state.dealerHand.showHoleCard ? state.dealerHand.value :
            (state.dealerHand.cards[0] ? new Card(state.dealerHand.cards[0].rank, state.dealerHand.cards[0].suit).value : '');

    // --- 3. SMART RENDER PLAYERS ---
    const handsContainer = document.getElementById('mp-players-hands');
    const handsSkeleton = document.getElementById('mp-hands-skeleton');

    // Hide skeleton, show actual hands during play
    if (handsSkeleton) handsSkeleton.style.display = 'none';
    if (handsContainer) handsContainer.style.display = 'block';

    // Remove hands of players who left
    Array.from(handsContainer.children).forEach(child => {
        const pid = child.getAttribute('data-player-id');
        if (!RoomState.players.find(p => p.id === pid)) {
            child.remove();
        }
    });

    RoomState.players.forEach(player => {
        const playerHandsArray = state.playerHands[player.id];
        if (!playerHandsArray) return;

        const isYou = player.id === RoomState.playerId;
        const currentHandIndex = state.currentHandIndex?.[player.id] || 0;

        // For EACH hand (supports splits)
        playerHandsArray.forEach((handData, handIndex) => {
            const handId = `mp-hand-${player.id}-${handIndex}`;
            let handEl = document.getElementById(handId);

            const isCurrentTurn = state.currentPlayerId === player.id && state.phase === 'playing';
            const isActiveHand = isCurrentTurn && currentHandIndex === handIndex;

            // Create container if not exists
            if (!handEl) {
                handEl = document.createElement('div');
                handEl.id = handId;
                handEl.setAttribute('data-player-id', player.id);
                handEl.setAttribute('data-hand-index', handIndex);
                handEl.className = `mp-player-hand`;
                handEl.innerHTML = `
                    <div class="mp-player-name"></div>
                    <div class="mp-player-cards"></div>
                    <div class="mp-player-value"></div>
                    <div class="result-container"></div>
                    <div class="bankroll-container"></div>
                    <div class="turn-indicator-container"></div>
                `;
                handsContainer.appendChild(handEl);
            }

            // Update classes - highlight active hand
            handEl.className = `mp-player-hand ${isActiveHand ? 'current-turn' : ''} ${isYou ? 'is-you' : ''}`;

            // Update Text Info
            const handLabel = playerHandsArray.length > 1 ? ` [Hand ${handIndex + 1}]` : '';
            handEl.querySelector('.mp-player-name').textContent = `${player.name}${handLabel} ${isYou ? '(You)' : ''}`;
            handEl.querySelector('.mp-player-value').textContent = `${handData.value} ${handData.isSoft ? '(soft)' : ''}`;

            // Update Cards
            const cardsEl = handEl.querySelector('.mp-player-cards');
            updateCardsContainer(cardsEl, handData.cards);

            // Update Result
            const resultContainer = handEl.querySelector('.result-container');
            if (handData.result) {
                const resultClass = handData.result === 'win' || handData.result === 'blackjack' ? 'result-win' :
                    handData.result === 'lose' || handData.result === 'busted' ? 'result-lose' : 'result-push';
                resultContainer.innerHTML = `<div class="mp-player-result ${resultClass}">${handData.result.toUpperCase()}</div>`;
            } else {
                resultContainer.innerHTML = '';
            }

            // Update Bankroll & Turn
            const bankrollDiv = handEl.querySelector('.bankroll-container');
            // Show total bankroll only on first hand, show bet on all hands
            if (handIndex === 0) {
                bankrollDiv.innerHTML = (state.phase === 'playing' || state.phase === 'results') ?
                    `<div class="mp-player-bankroll">${state.playerBankrolls[player.id]} (Bet: ${handData.bet})</div>` : '';
            } else {
                bankrollDiv.innerHTML = (state.phase === 'playing' || state.phase === 'results') ?
                    `<div class="mp-player-bankroll">(Bet: ${handData.bet})</div>` : '';
            }

            const turnDiv = handEl.querySelector('.turn-indicator-container');
            turnDiv.innerHTML = isActiveHand ? '<div class="turn-indicator">YOUR TURN</div>' : '';
        });

        // Remove extra hand elements if player has fewer hands now (shouldn't happen but safety)
        const existingHands = Array.from(handsContainer.querySelectorAll(`[data-player-id="${player.id}"]`));
        existingHands.forEach((el, idx) => {
            if (idx >= playerHandsArray.length) {
                el.remove();
            }
        });
    });

    // Show/hide action buttons
    const actionButtons = document.getElementById('mp-action-buttons');
    if (state.currentPlayerId === RoomState.playerId && state.phase === 'playing') {
        actionButtons.style.display = 'flex';

        // Enable/disable SPLIT button
        const myHandsArray = state.playerHands[RoomState.playerId];
        const myCurrentHandIndex = state.currentHandIndex[RoomState.playerId] || 0;
        const myHand = myHandsArray[myCurrentHandIndex];
        const splitBtn = document.getElementById('mp-btn-split');
        const doubleBtn = document.getElementById('mp-btn-double');

        if (splitBtn && myHand) {
            // Can only split if: exactly 2 cards, same rank, and enough bankroll
            const canSplit = myHand.cards.length === 2 &&
                myHand.cards[0].rank === myHand.cards[1].rank &&
                state.playerBankrolls[RoomState.playerId] >= myHand.bet;
            splitBtn.disabled = !canSplit;
            splitBtn.style.opacity = canSplit ? '1' : '0.5';
        }

        // Can only double on first action (2 cards)
        if (doubleBtn && myHand) {
            const canDouble = myHand.cards.length === 2 &&
                state.playerBankrolls[RoomState.playerId] >= myHand.bet;
            doubleBtn.disabled = !canDouble;
            doubleBtn.style.opacity = canDouble ? '1' : '0.5';
        }
    } else {
        actionButtons.style.display = 'none';
    }

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
    console.log('mpSelectBet called with amount:', amount);
    console.log('Current bet before:', RoomState.currentBet);
    console.log('Bankroll:', RoomState.bankroll);

    if (amount === -1) {
        RoomState.currentBet = 0;
    } else {
        if (RoomState.currentBet + amount <= RoomState.bankroll) {
            RoomState.currentBet += amount;

            // Play chip sound
            if (window.soundManager) {
                window.soundManager.playChip();
            }
        } else {
            console.log('Bet rejected: would exceed bankroll');
        }
    }

    console.log('Current bet after:', RoomState.currentBet);
    renderMultiplayerGame();
}

async function mpConfirmBet() {
    if (RoomState.currentBet <= 0) {
        showToast('!', 'Place a bet first');
        return;
    }
    showToast('✓', 'Bet Placed. Waiting for others...');
    await broadcastAction('bet', { amount: RoomState.currentBet });

    // If not connected, handle immediately (offline testing)
    if (!roomChannel) {
        handlePlayerAction({ playerId: RoomState.playerId, action: 'bet', data: { amount: RoomState.currentBet } });
    }
}

/**
 * Helper to update card containers intelligently
 */
function updateCardsContainer(container, cardsData) {
    const currentCount = container.children.length;
    const targetCount = cardsData.length;

    // Remove excess (should rarely happen in BJ, mainly for new rounds)
    if (currentCount > targetCount) {
        container.innerHTML = '';
    }

    // Append new cards
    for (let i = currentCount; i < targetCount; i++) {
        const c = cardsData[i];
        const cardObj = new Card(c.rank, c.suit);
        const el = cardObj.toElement(c.hide);

        // Add staggering delay
        // We use a global counter or relative index to stagger
        el.style.animationDelay = `${(i * 0.2)}s`;

        container.appendChild(el);
    }

    // Update existing cards (e.g. flip hole card)
    for (let i = 0; i < currentCount; i++) {
        const c = cardsData[i];
        const el = container.children[i];

        // Check if card needs to flip (was down, now up)
        if (el.classList.contains('face-down') && !c.hide) {
            // Replace the face-down card with the actual card
            const cardObj = new Card(c.rank, c.suit);
            const newEl = cardObj.toElement(false);
            newEl.style.animation = 'flipReveal 0.6s ease';
            container.replaceChild(newEl, el);
        }
    }
}

// ============================================================================
// SWIPE GESTURE SUPPORT (MOBILE)
// ============================================================================

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function setupSwipeGestures() {
    const gameArea = document.getElementById('multiplayer-game');
    if (!gameArea) return;

    gameArea.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    gameArea.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const state = RoomState.gameState;

    // Only allow swipes during your turn
    if (!state || state.currentPlayerId !== RoomState.playerId || state.phase !== 'playing') {
        return;
    }

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const minSwipeDistance = 50;

    // Determine if horizontal or vertical swipe
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                // Swipe right = HIT
                console.log('Swipe gesture: HIT');
                showToast('👉', 'Hit!');
                mpPlayerAction('hit');
            } else {
                // Swipe left = STAND
                console.log('Swipe gesture: STAND');
                showToast('👈', 'Stand!');
                mpPlayerAction('stand');
            }
        }
    } else {
        // Vertical swipe
        if (Math.abs(deltaY) > minSwipeDistance && deltaY < 0) {
            // Swipe up = DOUBLE
            const myHandsArray = state.playerHands[RoomState.playerId];
            const myCurrentHandIndex = state.currentHandIndex[RoomState.playerId] || 0;
            const myHand = myHandsArray[myCurrentHandIndex];

            // Check if double is allowed
            if (myHand && myHand.cards.length === 2 && state.playerBankrolls[RoomState.playerId] >= myHand.bet) {
                console.log('Swipe gesture: DOUBLE');
                showToast('👆', 'Double Down!');
                mpPlayerAction('double');
            }
        }
    }
}

// Initialize swipe gestures when page loads
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', setupSwipeGestures);
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
