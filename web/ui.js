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
        case 'classic':
            showScreen('classic-play');
            resetClassicPlayUI();
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
    // Settings UI removed, using defaults
    if (GameState.shoe) {
        GameState.shoe.penetration = GameState.settings.penetration;
    }
}

// Add event listeners for settings changes
// Settings listeners removed
// elements.dealerRule.addEventListener('change', loadSettings);
// elements.penetration.addEventListener('change', loadSettings);
// elements.cardsPerDrill.addEventListener('change', loadSettings);
// elements.drillSpeed.addEventListener('change', loadSettings);

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
    if (GameState.currentMode === 'classic') {
        // Classic mode shortcuts could be added here if needed
    }

    if (e.key === 'Escape') {
        if (elements.settingsPanel && elements.settingsPanel.classList.contains('active')) {
            toggleSettings();
        } else if (elements.countCheckModal && elements.countCheckModal.classList.contains('active')) {
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
    classicState.playerHand.bet = classicState.currentBet; // Track bet per hand
    classicState.playerHands = [classicState.playerHand];  // Initialize array
    classicState.activeHandIndex = 0;

    classicState.dealerHand = new Hand();

    classicState.playerHand.addCard(classicState.shoe.deal());
    classicState.dealerHand.addCard(classicState.shoe.deal());
    classicState.playerHand.addCard(classicState.shoe.deal());
    classicState.dealerHand.addCard(classicState.shoe.deal());

    // Render hands
    renderClassicHands(); // Use universal renderer
    classicState.dealerHand.render(elements.classicDealerCards, true);

    elements.classicPlayerValue.textContent = classicState.playerHand.value;
    elements.classicDealerValue.textContent = classicState.dealerHand.cards[0].value;

    // Hide betting, show actions
    elements.classicBettingArea.style.display = 'none';
    elements.classicActionButtons.style.display = 'block'; // Block ensures full width container
    elements.classicActionButtons.querySelector('.control-bar').style.display = 'flex'; // Ensure flex layout
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
    // Determine which hand is active
    const activeHandIndex = classicState.activeHandIndex || 0;
    const hands = classicState.playerHands || [classicState.playerHand];
    const hand = hands[activeHandIndex];

    // Safety check
    if (!hand) return;

    const btns = elements.classicActionButtons.querySelectorAll('button');

    btns.forEach(btn => {
        const action = btn.className.split(' ')[1];
        switch (action) {
            case 'double':
                // Can only double on first two cards
                btn.disabled = !hand.canDouble || classicState.bankroll < classicState.currentBet;
                break;
            case 'split':
                // Can only split on first action if pair
                // Limit to one split for now (max 2 hands)
                btn.disabled = !hand.canSplit || classicState.bankroll < classicState.currentBet || hands.length > 1;
                break;
            case 'surrender':
                // Can only surrender on first action of first hand
                btn.disabled = !hand.canSurrender || hands.length > 1;
                break;
            default:
                btn.disabled = false;
        }
    });

    // Highlight active hand in UI if split
    if (hands.length > 1) {
        document.querySelectorAll('.classic-hand-container').forEach((el, index) => {
            if (index === activeHandIndex) {
                el.classList.add('active-hand');
                el.style.border = '2px solid var(--gold)';
                el.style.boxShadow = '0 0 10px rgba(212, 175, 55, 0.3)';
            } else {
                el.classList.remove('active-hand');
                el.style.border = '2px solid transparent';
                el.style.boxShadow = 'none';
            }
        });
    }
}

function classicPlayerAction(action) {
    // Initialize hands array if not present
    if (!classicState.playerHands) {
        classicState.playerHands = [classicState.playerHand];
        classicState.activeHandIndex = 0;
    }

    const activeHandIndex = classicState.activeHandIndex;
    const hand = classicState.playerHands[activeHandIndex];

    switch (action) {
        case 'hit':
            const card = classicState.shoe.deal();
            hand.addCard(card);

            // Re-render specifically this hand
            renderClassicHands();

            if (hand.isBusted) {
                if (activeHandIndex < classicState.playerHands.length - 1) {
                    // Move to next hand
                    classicState.activeHandIndex++;
                    classicUpdateActionButtons();
                    renderClassicHands();
                } else {
                    // All hands done
                    classicDealerPlay();
                }
            } else if (hand.value === 21) {
                // Auto-stand on 21
                classicPlayerAction('stand');
            } else {
                classicUpdateActionButtons();
            }
            break;

        case 'stand':
            hand.isStood = true;
            if (activeHandIndex < classicState.playerHands.length - 1) {
                // Move to next hand
                classicState.activeHandIndex++;
                classicUpdateActionButtons();
                renderClassicHands();
            } else {
                // All hands done
                classicDealerPlay();
            }
            break;

        case 'double':
            classicState.bankroll -= hand.bet;
            classicState.totalBet = (classicState.totalBet || 0) + hand.bet;
            elements.classicBankroll.textContent = classicState.bankroll;

            hand.bet *= 2;
            hand.isDoubled = true;
            const dCard = classicState.shoe.deal();
            hand.addCard(dCard);

            renderClassicHands();

            if (hand.isBusted) {
                if (activeHandIndex < classicState.playerHands.length - 1) {
                    classicState.activeHandIndex++;
                    classicUpdateActionButtons();
                    renderClassicHands();
                } else {
                    classicDealerPlay();
                }
            } else {
                // Move to next hand or dealer
                if (activeHandIndex < classicState.playerHands.length - 1) {
                    classicState.activeHandIndex++;
                    classicUpdateActionButtons();
                    renderClassicHands();
                } else {
                    classicDealerPlay();
                }
            }
            break;

        case 'split':
            // 1. Deduct extra bet
            classicState.bankroll -= hand.bet;
            classicState.totalBet = (classicState.totalBet || 0) + hand.bet;
            elements.classicBankroll.textContent = classicState.bankroll;

            // 2. Create second hand
            const splitCard = hand.cards.pop(); // Remove 2nd card from 1st hand
            const hand2 = new Hand();
            hand2.bet = hand.bet;
            hand2.addCard(splitCard);

            hand.isSplit = true;
            hand2.isSplit = true;

            // 3. Deal 2nd card to each hand
            hand.addCard(classicState.shoe.deal());
            hand2.addCard(classicState.shoe.deal());

            // 4. Update State
            classicState.playerHands = [hand, hand2];
            classicState.activeHandIndex = 0; // Start with first hand

            // 5. Render
            renderClassicHands();
            classicUpdateActionButtons();
            break;

        case 'surrender':
            hand.isSurrendered = true;
            // Only end if it's the only hand, otherwise treated as "done" with "surrender" result
            // But usually surrender is only allowed on first 2 cards of initial hand.
            if (activeHandIndex < classicState.playerHands.length - 1) {
                classicState.activeHandIndex++;
                classicUpdateActionButtons();
                renderClassicHands();
            } else {
                classicDealerPlay();
            }
            break;
    }
}

function renderClassicHands() {
    const container = elements.classicPlayerCards;
    container.innerHTML = '';

    // Style container for multiple hands
    container.style.display = 'flex';
    container.style.gap = '2rem';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'flex-start';

    const hands = classicState.playerHands || [classicState.playerHand];

    hands.forEach((hand, index) => {
        const handDiv = document.createElement('div');
        handDiv.className = 'classic-hand-container';
        handDiv.style.position = 'relative';
        handDiv.style.padding = '15px';
        handDiv.style.borderRadius = '12px';
        handDiv.style.minWidth = '140px';
        handDiv.style.textAlign = 'center';
        handDiv.style.transition = 'all 0.3s ease';

        // Highlight active hand
        if (hands.length > 1 && index === classicState.activeHandIndex) {
            handDiv.classList.add('active-hand');
            handDiv.style.border = '2px solid var(--gold)';
            handDiv.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.4)';
            handDiv.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
        } else if (hands.length > 1) {
            handDiv.style.border = '2px solid transparent';
            handDiv.style.opacity = '0.8';
        }

        // Render Cards
        const cardContainer = document.createElement('div');
        cardContainer.className = 'cards-row';
        cardContainer.style.marginBottom = '10px';
        cardContainer.style.display = 'flex';
        cardContainer.style.justifyContent = 'center';

        hand.cards.forEach(card => {
            const cardEl = card.toElement();
            if (hands.length > 1) {
                cardEl.style.width = '60px'; // Slightly smaller cards for split
                cardEl.style.height = '84px';
                cardEl.style.fontSize = '0.9rem';
            }
            cardContainer.appendChild(cardEl);
        });
        handDiv.appendChild(cardContainer);

        // Render Value
        const valueDiv = document.createElement('div');
        valueDiv.className = 'hand-value';
        valueDiv.textContent = hand.value + (hand.isSoft ? ' (soft)' : '');
        valueDiv.style.color = index === classicState.activeHandIndex ? 'var(--gold)' : '#fff';
        valueDiv.style.fontWeight = 'bold';
        handDiv.appendChild(valueDiv);

        // Bet indicator
        const betDiv = document.createElement('div');
        betDiv.textContent = `$${hand.bet}`;
        betDiv.style.fontSize = '0.9rem';
        betDiv.style.marginTop = '5px';
        betDiv.style.color = 'var(--text-muted)';
        handDiv.appendChild(betDiv);

        container.appendChild(handDiv);
    });
}

function classicDealerPlay() {
    const dealerHand = classicState.dealerHand;
    const dealerRule = GameState.settings.dealerRule || 'h17';

    // Reveal
    elements.classicDealerCards.innerHTML = '';
    dealerHand.cards.forEach(card => {
        elements.classicDealerCards.appendChild(card.toElement());
    });

    while (true) {
        const value = dealerHand.value;
        const isSoft17 = value === 17 && dealerHand.isSoft;

        if (value > 17) break;
        if (value === 17 && !isSoft17) break;
        if (value === 17 && isSoft17 && dealerRule === 's17') break; // Stand on soft 17

        dealerHand.addCard(classicState.shoe.deal());
    }

    // Final render
    elements.classicDealerCards.innerHTML = '';
    dealerHand.cards.forEach(card => {
        elements.classicDealerCards.appendChild(card.toElement());
    });
    elements.classicDealerValue.textContent = dealerHand.value;

    classicEndHand();
}

function classicEndHand(forceResult, forceMessage) {
    elements.classicActionButtons.style.display = 'none';

    const dealerHand = classicState.dealerHand;
    const hands = classicState.playerHands || [classicState.playerHand];

    let totalWin = 0;
    let anyWin = false;
    let summary = '';

    hands.forEach((hand, i) => {
        let result = '';
        let payout = 0;

        if (hand.isSurrendered) {
            result = 'surrender';
            payout = hand.bet * 0.5;
        } else if (hand.isBusted) {
            result = 'lose';
            payout = 0;
        } else {
            // Dealer busted or player higher
            if (dealerHand.isBusted || hand.value > dealerHand.value) {
                result = 'win';
                if (hand.isBlackjack && !dealerHand.isBlackjack) {
                    payout = hand.bet + (hand.bet * 1.5);
                    result = 'blackjack';
                } else {
                    payout = hand.bet * 2;
                }
            } else if (hand.value < dealerHand.value) {
                result = 'lose';
                payout = 0;
            } else {
                result = 'push';
                payout = hand.bet;
            }
        }

        if (payout > 0) anyWin = true;
        totalWin += payout; // This payout includes the original bet returned

        if (hands.length > 1) {
            const resShort = result === 'blackjack' ? 'BJ' : result.toUpperCase();
            summary += `H${i + 1}: ${resShort} `;
        } else {
            summary = forceMessage || (result === 'blackjack' ? 'BLACKJACK!' :
                result === 'win' ? 'YOU WIN!' :
                    result === 'push' ? 'PUSH' :
                        result === 'surrender' ? 'SURRENDERED' : 'DEALER WINS');
        }

        // Update visual result on hand (add result class to hand div if needed in future)
    });

    // Determine net profit/loss for bankroll update
    // We already deducted bets from bankroll. So totalWin is what we add back.
    classicState.bankroll += totalWin;
    elements.classicBankroll.textContent = classicState.bankroll;

    // Calculate net for message
    const totalBet = hands.reduce((sum, h) => sum + h.bet, 0);
    const net = totalWin - totalBet;

    let resultColor = net > 0 ? 'green' : (net < 0 ? 'red' : 'gold');

    // Show continue button
    elements.classicBettingArea.style.display = 'flex';
    elements.classicBettingArea.innerHTML = `
        <div class="current-bet" style="font-size: 1.5rem; color: var(--${resultColor});">
            ${summary}
        </div>
        <div style="font-size: 1rem; color: #aaa; margin-bottom: 1rem;">
            ${net > 0 ? `Won $${net}` : (net < 0 ? `Lost $${Math.abs(net)}` : 'Push')}
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
window.showScreen = showScreen;
window.showToast = showToast;
