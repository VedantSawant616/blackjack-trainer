/**
 * ui.js - User interface and event handling
 * Connects DOM elements to game logic
 */

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
    // Screens
    modeSelect: document.getElementById('mode-select'),
    countingDrill: document.getElementById('counting-drill'),
    fullPlay: document.getElementById('full-play'),
    strategyDrill: document.getElementById('strategy-drill'),
    classicPlay: document.getElementById('classic-play'),
    settingsPanel: document.getElementById('settings-panel'),

    // Header stats
    sessionHands: document.getElementById('session-hands'),
    sessionAccuracy: document.getElementById('session-accuracy'),
    currentStreak: document.getElementById('current-streak'),

    // Settings
    dealerRule: document.getElementById('dealer-rule'),
    penetration: document.getElementById('penetration'),
    cardsPerDrill: document.getElementById('cards-per-drill'),
    drillSpeed: document.getElementById('drill-speed'),

    // Counting drill
    drillCards: document.getElementById('drill-cards'),
    userCount: document.getElementById('user-count'),
    submitCount: document.getElementById('submit-count'),
    countPrompt: document.getElementById('count-prompt'),
    feedbackArea: document.getElementById('feedback-area'),
    feedbackIcon: document.getElementById('feedback-icon'),
    feedbackText: document.getElementById('feedback-text'),
    nextDrill: document.getElementById('next-drill'),
    penFill: document.getElementById('pen-fill'),
    penText: document.getElementById('pen-text'),
    actualRC: document.getElementById('actual-rc'),
    actualTC: document.getElementById('actual-tc'),

    // Full play
    dealerCards: document.getElementById('dealer-cards'),
    playerCards: document.getElementById('player-cards'),
    dealerValue: document.getElementById('dealer-value'),
    playerValue: document.getElementById('player-value'),
    gameStatus: document.getElementById('game-status'),
    actionButtons: document.getElementById('action-buttons'),
    bettingArea: document.getElementById('betting-area'),
    currentBetAmount: document.getElementById('current-bet-amount'),
    bankroll: document.getElementById('bankroll'),
    dealBtn: document.getElementById('deal-btn'),
    playRC: document.getElementById('play-rc'),
    playTC: document.getElementById('play-tc'),
    countCheckModal: document.getElementById('count-check-modal'),
    modalCount: document.getElementById('modal-count'),

    // Strategy drill
    stratDealerCard: document.getElementById('strat-dealer-card'),
    stratPlayerCards: document.getElementById('strat-player-cards'),
    stratHandValue: document.getElementById('strat-hand-value'),
    strategyFeedback: document.getElementById('strategy-feedback'),
    nextStrat: document.getElementById('next-strat'),

    // Classic play
    classicDealerCards: document.getElementById('classic-dealer-cards'),
    classicPlayerCards: document.getElementById('classic-player-cards'),
    classicDealerValue: document.getElementById('classic-dealer-value'),
    classicPlayerValue: document.getElementById('classic-player-value'),
    classicGameStatus: document.getElementById('classic-game-status'),
    classicActionButtons: document.getElementById('classic-action-buttons'),
    classicBettingArea: document.getElementById('classic-betting-area'),
    classicBetAmount: document.getElementById('classic-bet-amount'),
    classicBankroll: document.getElementById('classic-bankroll'),
    classicDealBtn: document.getElementById('classic-deal-btn'),

    // Toast
    toast: document.getElementById('toast')
};

// Classic mode state
let classicState = {
    bankroll: 1000,
    currentBet: 0,
    playerHand: null,
    dealerHand: null,
    shoe: null
};

// Current strategy drill state
let currentStrategyHand = null;
let currentDealerCard = null;

// ============================================================================
// SCREEN NAVIGATION
// ============================================================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function startMode(mode) {
    GameState.currentMode = mode;
    GameState.reset();
    loadSettings();

    switch (mode) {
        case 'counting':
            showScreen('counting-drill');
            updatePenetrationBar();
            updateDrillStats();
            elements.drillCards.innerHTML = '<p style="color: var(--gold);">Press "Deal Cards" to start</p>';
            elements.feedbackArea.classList.remove('show');
            break;
        case 'fullplay':
            showScreen('full-play');
            resetFullPlayUI();
            break;
        case 'strategy':
            showScreen('strategy-drill');
            elements.strategyFeedback.className = 'strategy-feedback';
            elements.strategyFeedback.textContent = '';
            nextStrategyHand();
            break;
        case 'classic':
            console.log('Starting classic mode...');
            showScreen('classic-play');
            console.log('Screen shown, calling resetClassicPlayUI...');
            resetClassicPlayUI();
            console.log('Classic mode initialized');
            break;
    }
}

function backToMenu() {
    showScreen('mode-select');
    GameState.currentMode = null;
}

// ============================================================================
// SETTINGS
// ============================================================================

function toggleSettings() {
    elements.settingsPanel.classList.toggle('active');
}

function loadSettings() {
    GameState.settings.dealerRule = elements.dealerRule.value;
    GameState.settings.penetration = parseFloat(elements.penetration.value);
    GameState.settings.cardsPerDrill = parseInt(elements.cardsPerDrill.value);
    GameState.settings.speed = elements.drillSpeed.value;

    if (GameState.shoe) {
        GameState.shoe.penetration = GameState.settings.penetration;
    }
}

// Add event listeners for settings changes
elements.dealerRule.addEventListener('change', loadSettings);
elements.penetration.addEventListener('change', loadSettings);
elements.cardsPerDrill.addEventListener('change', loadSettings);
elements.drillSpeed.addEventListener('change', loadSettings);

// ============================================================================
// COUNTING DRILL
// ============================================================================

function nextDrill() {
    // Check for shuffle
    if (GameState.shoe.needsShuffle) {
        GameState.shoe.shuffle();
        GameState.runningCount = 0;
        showToast('🔄', 'Deck reshuffled');
    }

    // Deal cards
    const cards = dealDrillCards();

    // Display cards
    elements.drillCards.innerHTML = '';
    cards.forEach((card, i) => {
        const el = card.toElement();
        el.style.animationDelay = `${i * 0.15}s`;
        elements.drillCards.appendChild(el);
    });

    // Update UI
    elements.feedbackArea.classList.remove('show');
    elements.countPrompt.textContent = 'What is the Running Count?';
    elements.submitCount.disabled = false;
    GameState.userCount = 0;
    elements.userCount.textContent = '0';

    updatePenetrationBar();
}

function adjustCount(delta) {
    GameState.userCount += delta;
    elements.userCount.textContent = GameState.userCount >= 0 ? `+${GameState.userCount}` : GameState.userCount;
}

function submitCount() {
    const isCorrect = GameState.userCount === GameState.runningCount;

    // Update stats
    GameState.stats.countChecks++;
    if (isCorrect) {
        GameState.stats.countCorrect++;
        GameState.stats.currentStreak++;
        GameState.stats.bestStreak = Math.max(GameState.stats.bestStreak, GameState.stats.currentStreak);
    } else {
        GameState.stats.currentStreak = 0;
    }

    // Show feedback
    elements.feedbackArea.classList.add('show');
    elements.feedbackArea.classList.remove('correct', 'incorrect');
    elements.feedbackArea.classList.add(isCorrect ? 'correct' : 'incorrect');
    elements.feedbackIcon.textContent = isCorrect ? '✓' : '✗';
    elements.feedbackText.textContent = isCorrect
        ? `Correct! RC = ${GameState.runningCount >= 0 ? '+' : ''}${GameState.runningCount}`
        : `Incorrect. RC = ${GameState.runningCount >= 0 ? '+' : ''}${GameState.runningCount}`;

    updateDrillStats();
    updateHeaderStats();

    elements.submitCount.disabled = true;
}

function updatePenetrationBar() {
    const remaining = GameState.shoe.remaining;
    const pct = (remaining / 52) * 100;
    elements.penFill.style.width = `${pct}%`;
    elements.penText.textContent = `${remaining} cards`;
}

function updateDrillStats() {
    const rc = GameState.runningCount;
    const tc = GameState.trueCount.toFixed(1);
    elements.actualRC.textContent = rc >= 0 ? `+${rc}` : rc;
    elements.actualTC.textContent = tc >= 0 ? `+${tc}` : tc;
}

// ============================================================================
// FULL PLAY MODE
// ============================================================================

function resetFullPlayUI() {
    elements.dealerCards.innerHTML = '';
    elements.playerCards.innerHTML = '';
    elements.dealerValue.textContent = '';
    elements.playerValue.textContent = '';
    elements.gameStatus.textContent = 'Place Your Bet';
    elements.actionButtons.style.display = 'none';

    // Restore original betting area HTML (endHand replaces it)
    elements.bettingArea.innerHTML = `
        <div class="chip-stack">
            <div class="chip chip-5" onclick="addBet(5)">5</div>
            <div class="chip chip-25" onclick="addBet(25)">25</div>
            <div class="chip chip-100" onclick="addBet(100)">100</div>
        </div>
        <div class="current-bet">
            <span>Bet: $</span><span id="current-bet-amount">0</span>
        </div>
        <button class="btn btn-primary" id="deal-btn" onclick="dealHand()">DEAL</button>
    `;
    elements.currentBetAmount = document.getElementById('current-bet-amount');
    elements.dealBtn = document.getElementById('deal-btn');

    elements.bettingArea.style.display = 'flex';
    GameState.currentBet = 0;
    elements.currentBetAmount.textContent = '0';
    elements.bankroll.textContent = GameState.bankroll;
    hideCount();
}

function addBet(amount) {
    if (GameState.bankroll >= amount + GameState.currentBet) {
        GameState.currentBet += amount;
        elements.currentBetAmount.textContent = GameState.currentBet;
    }
}

function dealHand() {
    if (GameState.currentBet === 0) {
        showToast('⚠️', 'Place a bet first');
        return;
    }

    // Check shuffle
    if (GameState.shoe.needsShuffle) {
        GameState.shoe.shuffle();
        GameState.runningCount = 0;
        showToast('🔄', 'Deck reshuffled');
    }

    // Deduct bet
    GameState.bankroll -= GameState.currentBet;
    elements.bankroll.textContent = GameState.bankroll;

    // Deal cards
    dealInitialCards();

    // Render hands
    GameState.playerHand.render(elements.playerCards);
    GameState.dealerHand.render(elements.dealerCards, true); // Hide hole card

    elements.playerValue.textContent = GameState.playerHand.value;
    elements.dealerValue.textContent = GameState.dealerHand.cards[0].value;

    // Hide betting, show actions
    elements.bettingArea.style.display = 'none';
    elements.actionButtons.style.display = 'flex';
    elements.gameStatus.textContent = 'Your Turn';

    updateActionButtons();

    // Check for player blackjack
    if (GameState.playerHand.isBlackjack) {
        revealDealerHoleCard();
        GameState.dealerHand.render(elements.dealerCards);
        elements.dealerValue.textContent = GameState.dealerHand.value;

        if (GameState.dealerHand.isBlackjack) {
            endHand('push', 'Both Blackjack - Push');
        } else {
            endHand('blackjack', 'BLACKJACK!');
        }
    }
}

function updateActionButtons() {
    const hand = GameState.playerHand;
    const btns = elements.actionButtons.querySelectorAll('button');

    btns.forEach(btn => {
        const action = btn.className.split(' ')[1];
        switch (action) {
            case 'double':
                btn.disabled = !hand.canDouble || GameState.bankroll < GameState.currentBet;
                break;
            case 'split':
                btn.disabled = !hand.canSplit || GameState.bankroll < GameState.currentBet;
                break;
            case 'surrender':
                btn.disabled = !hand.canSurrender;
                break;
            default:
                btn.disabled = false;
        }
    });
}

function playerAction(action) {
    const hand = GameState.playerHand;
    const dealerUpcard = GameState.dealerHand.cards[0];

    // Check if action is correct
    const isCorrect = isActionCorrect(action, hand, dealerUpcard);
    const correctAction = getCorrectAction(hand, dealerUpcard, hand.canDouble, hand.canSplit, hand.canSurrender);

    GameState.stats.handsPlayed++;
    if (isCorrect) {
        GameState.stats.correctDecisions++;
        GameState.stats.currentStreak++;
        GameState.stats.bestStreak = Math.max(GameState.stats.bestStreak, GameState.stats.currentStreak);
    } else {
        GameState.stats.currentStreak = 0;
        showToast('⚠️', `Basic strategy: ${correctAction.toUpperCase()}`);
    }

    updateHeaderStats();

    // Execute action
    switch (action) {
        case 'hit':
            const card = GameState.shoe.deal();
            hand.addCard(card);
            GameState.countCard(card);
            GameState.playerHand.render(elements.playerCards);
            elements.playerValue.textContent = hand.value;

            if (hand.isBusted) {
                revealDealerHoleCard();
                GameState.dealerHand.render(elements.dealerCards);
                elements.dealerValue.textContent = GameState.dealerHand.value;
                endHand('lose', 'Bust!');
            } else if (hand.value === 21) {
                playerAction('stand');
            } else {
                updateActionButtons();
            }
            break;

        case 'stand':
            hand.isStood = true;
            revealDealerHoleCard();
            GameState.dealerHand.render(elements.dealerCards);
            elements.dealerValue.textContent = GameState.dealerHand.value;
            dealerPlay();
            GameState.dealerHand.render(elements.dealerCards);
            elements.dealerValue.textContent = GameState.dealerHand.value;

            const result = determineWinner();
            endHand(result.result, getResultMessage(result.result));
            break;

        case 'double':
            GameState.bankroll -= GameState.currentBet;
            GameState.currentBet *= 2;
            elements.bankroll.textContent = GameState.bankroll;
            hand.isDoubled = true;

            const dCard = GameState.shoe.deal();
            hand.addCard(dCard);
            GameState.countCard(dCard);
            GameState.playerHand.render(elements.playerCards);
            elements.playerValue.textContent = hand.value;

            if (hand.isBusted) {
                revealDealerHoleCard();
                GameState.dealerHand.render(elements.dealerCards);
                elements.dealerValue.textContent = GameState.dealerHand.value;
                endHand('lose', 'Bust!');
            } else {
                playerAction('stand');
            }
            break;

        case 'split':
            // Simplified split - just show message for now
            showToast('ℹ️', 'Split not fully implemented');
            break;

        case 'surrender':
            hand.isSurrendered = true;
            revealDealerHoleCard();
            GameState.dealerHand.render(elements.dealerCards);
            elements.dealerValue.textContent = GameState.dealerHand.value;
            endHand('surrender', 'Surrendered');
            break;
    }
}

function getResultMessage(result) {
    const messages = {
        'win': 'You Win!',
        'lose': 'Dealer Wins',
        'push': 'Push',
        'blackjack': 'BLACKJACK!',
        'surrender': 'Surrendered'
    };
    return messages[result] || result;
}

function endHand(result, message) {
    elements.actionButtons.style.display = 'none';
    elements.gameStatus.textContent = message;

    // Calculate payout
    const outcome = determineWinner();
    GameState.bankroll += outcome.payout;
    elements.bankroll.textContent = GameState.bankroll;

    // Show continue button in betting area
    elements.bettingArea.style.display = 'flex';
    elements.bettingArea.innerHTML = `
        <div class="current-bet" style="font-size: 1.5rem; color: var(--${result === 'win' || result === 'blackjack' ? 'green' : result === 'lose' ? 'red' : 'gold'});">
            ${message}
        </div>
        <button class="btn btn-primary" onclick="resetFullPlayUI()">Next Hand</button>
    `;

    // Random count check (30% of hands)
    if (Math.random() < 0.3) {
        setTimeout(() => {
            elements.countCheckModal.classList.add('active');
            GameState.modalCount = 0;
            elements.modalCount.textContent = '0';
        }, 1000);
    }
}

function showCount() {
    elements.playRC.textContent = GameState.runningCount >= 0 ? `+${GameState.runningCount}` : GameState.runningCount;
    elements.playTC.textContent = GameState.trueCount >= 0 ? `+${GameState.trueCount.toFixed(1)}` : GameState.trueCount.toFixed(1);
}

function hideCount() {
    elements.playRC.textContent = '?';
    elements.playTC.textContent = '?';
}

function adjustModalCount(delta) {
    GameState.modalCount += delta;
    elements.modalCount.textContent = GameState.modalCount >= 0 ? `+${GameState.modalCount}` : GameState.modalCount;
}

function submitModalCount() {
    elements.countCheckModal.classList.remove('active');

    const isCorrect = GameState.modalCount === GameState.runningCount;
    GameState.stats.countChecks++;

    if (isCorrect) {
        GameState.stats.countCorrect++;
        showToast('✓', `Correct! RC = ${GameState.runningCount >= 0 ? '+' : ''}${GameState.runningCount}`);
    } else {
        showToast('✗', `Wrong. RC = ${GameState.runningCount >= 0 ? '+' : ''}${GameState.runningCount}`);
    }

    updateHeaderStats();
}

// ============================================================================
// STRATEGY DRILL
// ============================================================================

function nextStrategyHand() {
    const { playerHand, dealerCard } = generateStrategyHand();
    currentStrategyHand = playerHand;
    currentDealerCard = dealerCard;

    // Render
    playerHand.render(elements.stratPlayerCards);
    elements.stratDealerCard.innerHTML = '';
    elements.stratDealerCard.appendChild(dealerCard.toElement());

    elements.stratHandValue.textContent = playerHand.value + (playerHand.isSoft ? ' (soft)' : '');
    elements.strategyFeedback.className = 'strategy-feedback';
    elements.strategyFeedback.textContent = '';

    // Update buttons
    const btns = document.querySelectorAll('#strategy-drill .action-btn');
    btns.forEach(btn => btn.disabled = false);

    // Disable invalid actions
    btns.forEach(btn => {
        const action = btn.className.split(' ')[1];
        if (action === 'split' && !playerHand.canSplit) btn.disabled = true;
        if (action === 'double' && !playerHand.canDouble) btn.disabled = true;
        if (action === 'surrender' && !playerHand.canSurrender) btn.disabled = true;
    });
}

function strategyAction(action) {
    const correct = getCorrectAction(
        currentStrategyHand,
        currentDealerCard,
        currentStrategyHand.canDouble,
        currentStrategyHand.canSplit,
        currentStrategyHand.canSurrender
    );

    const isCorrect = action === correct ||
        (correct === 'double' && action === 'hit' && !currentStrategyHand.canDouble);

    GameState.stats.handsPlayed++;
    if (isCorrect) {
        GameState.stats.correctDecisions++;
        GameState.stats.currentStreak++;
        GameState.stats.bestStreak = Math.max(GameState.stats.bestStreak, GameState.stats.currentStreak);
        elements.strategyFeedback.className = 'strategy-feedback correct';
        elements.strategyFeedback.textContent = '✓ Correct!';
    } else {
        GameState.stats.currentStreak = 0;
        elements.strategyFeedback.className = 'strategy-feedback incorrect';
        elements.strategyFeedback.textContent = `✗ Correct answer: ${correct.toUpperCase()}`;
    }

    updateHeaderStats();

    // Disable buttons
    const btns = document.querySelectorAll('#strategy-drill .action-btn');
    btns.forEach(btn => btn.disabled = true);
}

// ============================================================================
// HEADER STATS
// ============================================================================

function updateHeaderStats() {
    elements.sessionHands.textContent = GameState.stats.handsPlayed;

    const accuracy = GameState.stats.handsPlayed > 0
        ? Math.round((GameState.stats.correctDecisions / GameState.stats.handsPlayed) * 100)
        : 0;
    elements.sessionAccuracy.textContent = `${accuracy}%`;

    elements.currentStreak.textContent = GameState.stats.currentStreak;
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(icon, message) {
    elements.toast.querySelector('.toast-icon').textContent = icon;
    elements.toast.querySelector('.toast-message').textContent = message;
    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

document.addEventListener('keydown', (e) => {
    if (GameState.currentMode === 'counting') {
        if (e.key === 'ArrowUp') adjustCount(1);
        if (e.key === 'ArrowDown') adjustCount(-1);
        if (e.key === 'Enter' && !elements.submitCount.disabled) submitCount();
        if (e.key === ' ') nextDrill();
    }

    if (GameState.currentMode === 'fullplay' && elements.actionButtons.style.display !== 'none') {
        if (e.key === 'h') playerAction('hit');
        if (e.key === 's') playerAction('stand');
        if (e.key === 'd') playerAction('double');
        if (e.key === 'p') playerAction('split');
        if (e.key === 'r') playerAction('surrender');
    }

    if (GameState.currentMode === 'strategy') {
        if (e.key === 'h') strategyAction('hit');
        if (e.key === 's') strategyAction('stand');
        if (e.key === 'd') strategyAction('double');
        if (e.key === 'p') strategyAction('split');
        if (e.key === 'r') strategyAction('surrender');
        if (e.key === ' ') nextStrategyHand();
    }

    if (e.key === 'Escape') {
        if (elements.settingsPanel.classList.contains('active')) {
            toggleSettings();
        } else if (elements.countCheckModal.classList.contains('active')) {
            elements.countCheckModal.classList.remove('active');
        } else {
            backToMenu();
        }
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    console.log('Blackjack Counting Trainer loaded');
});

// ============================================================================
// CLASSIC BLACKJACK MODE
// ============================================================================

function resetClassicPlayUI() {
    // Initialize shoe if needed
    if (!classicState.shoe) {
        classicState.shoe = new Shoe(1);
        classicState.shoe.shuffle();
    }

    elements.classicDealerCards.innerHTML = '';
    elements.classicPlayerCards.innerHTML = '';
    elements.classicDealerValue.textContent = '';
    elements.classicPlayerValue.textContent = '';
    elements.classicGameStatus.textContent = 'Place Your Bet';
    elements.classicActionButtons.style.display = 'none';

    // Restore betting area
    elements.classicBettingArea.innerHTML = `
        <div class="chip-stack">
            <div class="chip chip-5" onclick="classicAddBet(5)">5</div>
            <div class="chip chip-25" onclick="classicAddBet(25)">25</div>
            <div class="chip chip-100" onclick="classicAddBet(100)">100</div>
        </div>
        <div class="current-bet">
            <span>Bet: $</span><span id="classic-bet-amount">0</span>
        </div>
        <button class="btn btn-primary" id="classic-deal-btn" onclick="classicDealHand()">DEAL</button>
    `;
    elements.classicBetAmount = document.getElementById('classic-bet-amount');
    elements.classicDealBtn = document.getElementById('classic-deal-btn');

    elements.classicBettingArea.style.display = 'flex';
    classicState.currentBet = 0;
    elements.classicBetAmount.textContent = '0';
    elements.classicBankroll.textContent = classicState.bankroll;
}

function classicAddBet(amount) {
    if (classicState.bankroll >= amount + classicState.currentBet) {
        classicState.currentBet += amount;
        elements.classicBetAmount.textContent = classicState.currentBet;
    }
}

function classicDealHand() {
    if (classicState.currentBet === 0) {
        showToast('!', 'Place a bet first');
        return;
    }

    // Check shuffle
    if (classicState.shoe.needsShuffle) {
        classicState.shoe.shuffle();
        showToast('↻', 'Deck reshuffled');
    }

    // Deduct bet
    classicState.bankroll -= classicState.currentBet;
    elements.classicBankroll.textContent = classicState.bankroll;

    // Deal cards
    classicState.playerHand = new Hand();
    classicState.dealerHand = new Hand();

    classicState.playerHand.addCard(classicState.shoe.deal());
    classicState.dealerHand.addCard(classicState.shoe.deal());
    classicState.playerHand.addCard(classicState.shoe.deal());
    classicState.dealerHand.addCard(classicState.shoe.deal());

    // Render hands
    classicState.playerHand.render(elements.classicPlayerCards);
    classicState.dealerHand.render(elements.classicDealerCards, true);

    elements.classicPlayerValue.textContent = classicState.playerHand.value;
    elements.classicDealerValue.textContent = classicState.dealerHand.cards[0].value;

    // Hide betting, show actions
    elements.classicBettingArea.style.display = 'none';
    elements.classicActionButtons.style.display = 'flex';
    elements.classicGameStatus.textContent = 'Your Turn';

    classicUpdateActionButtons();

    // Check for player blackjack
    if (classicState.playerHand.isBlackjack) {
        classicState.dealerHand.render(elements.classicDealerCards);
        elements.classicDealerValue.textContent = classicState.dealerHand.value;

        if (classicState.dealerHand.isBlackjack) {
            classicEndHand('push', 'Both Blackjack - Push');
        } else {
            classicEndHand('blackjack', 'BLACKJACK!');
        }
    }
}

function classicUpdateActionButtons() {
    const hand = classicState.playerHand;
    const btns = elements.classicActionButtons.querySelectorAll('button');

    btns.forEach(btn => {
        const action = btn.className.split(' ')[1];
        switch (action) {
            case 'double':
                btn.disabled = !hand.canDouble || classicState.bankroll < classicState.currentBet;
                break;
            case 'split':
                btn.disabled = !hand.canSplit || classicState.bankroll < classicState.currentBet;
                break;
            case 'surrender':
                btn.disabled = !hand.canSurrender;
                break;
            default:
                btn.disabled = false;
        }
    });
}

function classicPlayerAction(action) {
    const hand = classicState.playerHand;

    switch (action) {
        case 'hit':
            const card = classicState.shoe.deal();
            hand.addCard(card);
            classicState.playerHand.render(elements.classicPlayerCards);
            elements.classicPlayerValue.textContent = hand.value;

            if (hand.isBusted) {
                classicState.dealerHand.render(elements.classicDealerCards);
                elements.classicDealerValue.textContent = classicState.dealerHand.value;
                classicEndHand('lose', 'Bust!');
            } else if (hand.value === 21) {
                classicPlayerAction('stand');
            } else {
                classicUpdateActionButtons();
            }
            break;

        case 'stand':
            hand.isStood = true;
            classicState.dealerHand.render(elements.classicDealerCards);
            elements.classicDealerValue.textContent = classicState.dealerHand.value;
            classicDealerPlay();
            classicState.dealerHand.render(elements.classicDealerCards);
            elements.classicDealerValue.textContent = classicState.dealerHand.value;

            const result = classicDetermineWinner();
            classicEndHand(result.result, classicGetResultMessage(result.result));
            break;

        case 'double':
            classicState.bankroll -= classicState.currentBet;
            classicState.currentBet *= 2;
            elements.classicBankroll.textContent = classicState.bankroll;
            hand.isDoubled = true;

            const dCard = classicState.shoe.deal();
            hand.addCard(dCard);
            classicState.playerHand.render(elements.classicPlayerCards);
            elements.classicPlayerValue.textContent = hand.value;

            if (hand.isBusted) {
                classicState.dealerHand.render(elements.classicDealerCards);
                elements.classicDealerValue.textContent = classicState.dealerHand.value;
                classicEndHand('lose', 'Bust!');
            } else {
                classicPlayerAction('stand');
            }
            break;

        case 'split':
            showToast('i', 'Split not fully implemented');
            break;

        case 'surrender':
            hand.isSurrendered = true;
            classicState.dealerHand.render(elements.classicDealerCards);
            elements.classicDealerValue.textContent = classicState.dealerHand.value;
            classicEndHand('surrender', 'Surrendered');
            break;
    }
}

function classicDealerPlay() {
    const dealerHand = classicState.dealerHand;
    const dealerRule = GameState.settings.dealerRule || 'h17';

    while (true) {
        const value = dealerHand.value;
        const isSoft17 = value === 17 && dealerHand.isSoft;

        if (value > 17) break;
        if (value === 17 && !isSoft17) break;
        if (value === 17 && isSoft17 && dealerRule === 's17') break;

        dealerHand.addCard(classicState.shoe.deal());
    }
}

function classicDetermineWinner() {
    const player = classicState.playerHand;
    const dealer = classicState.dealerHand;
    const bet = classicState.currentBet;

    if (player.isSurrendered) return { result: 'surrender', payout: bet / 2 };
    if (player.isBusted) return { result: 'lose', payout: 0 };
    if (player.isBlackjack && !dealer.isBlackjack) return { result: 'blackjack', payout: bet * 2.5 };
    if (dealer.isBusted) return { result: 'win', payout: bet * 2 };
    if (player.value > dealer.value) return { result: 'win', payout: bet * 2 };
    if (player.value < dealer.value) return { result: 'lose', payout: 0 };
    return { result: 'push', payout: bet };
}

function classicGetResultMessage(result) {
    const messages = {
        'win': 'You Win!',
        'lose': 'Dealer Wins',
        'push': 'Push',
        'blackjack': 'BLACKJACK!',
        'surrender': 'Surrendered'
    };
    return messages[result] || result;
}

function classicEndHand(result, message) {
    elements.classicActionButtons.style.display = 'none';
    elements.classicGameStatus.textContent = message;

    const outcome = classicDetermineWinner();
    classicState.bankroll += outcome.payout;
    elements.classicBankroll.textContent = classicState.bankroll;

    // Show continue button
    elements.classicBettingArea.style.display = 'flex';
    elements.classicBettingArea.innerHTML = `
        <div class="current-bet" style="font-size: 1.5rem; color: var(--${result === 'win' || result === 'blackjack' ? 'green' : result === 'lose' ? 'red' : 'gold'});">
            ${message}
        </div>
        <button class="btn btn-primary" onclick="resetClassicPlayUI()">Next Hand</button>
    `;
}

// Make functions available globally
window.startMode = startMode;
window.backToMenu = backToMenu;
window.toggleSettings = toggleSettings;
window.nextDrill = nextDrill;
window.adjustCount = adjustCount;
window.submitCount = submitCount;
window.addBet = addBet;
window.dealHand = dealHand;
window.playerAction = playerAction;
window.showCount = showCount;
window.adjustModalCount = adjustModalCount;
window.submitModalCount = submitModalCount;
window.nextStrategyHand = nextStrategyHand;
window.strategyAction = strategyAction;
window.classicAddBet = classicAddBet;
window.classicDealHand = classicDealHand;
window.classicPlayerAction = classicPlayerAction;
window.resetClassicPlayUI = resetClassicPlayUI;
