/**
 * game.js - Game logic and state management
 * Blackjack game engine with counting and strategy validation
 */

// ============================================================================
// BASIC STRATEGY TABLES (Single Deck, H17)
// ============================================================================

// Actions: H=Hit, S=Stand, D=Double, P=Split, Rh=Surrender/Hit, Rs=Surrender/Stand
const HARD_STRATEGY = {
    // Player total: { dealerUpcard: action }
    5: { 2: 'H', 3: 'H', 4: 'H', 5: 'H', 6: 'H', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    6: { 2: 'H', 3: 'H', 4: 'H', 5: 'H', 6: 'H', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    7: { 2: 'H', 3: 'H', 4: 'H', 5: 'H', 6: 'H', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    8: { 2: 'H', 3: 'H', 4: 'H', 5: 'H', 6: 'H', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    9: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    10: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'D', 8: 'D', 9: 'D', 10: 'H', 11: 'H' },
    11: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'D', 8: 'D', 9: 'D', 10: 'D', 11: 'D' },
    12: { 2: 'H', 3: 'H', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    13: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    14: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    15: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'Rh', 11: 'Rh' },
    16: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'Rh', 10: 'Rh', 11: 'Rh' },
    17: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    18: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    19: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    20: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    21: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
};

const SOFT_STRATEGY = {
    // Soft total (A counted as 11): { dealerUpcard: action }
    13: { 2: 'H', 3: 'H', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    14: { 2: 'H', 3: 'H', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    15: { 2: 'H', 3: 'H', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    16: { 2: 'H', 3: 'H', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    17: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    18: { 2: 'S', 3: 'Ds', 4: 'Ds', 5: 'Ds', 6: 'Ds', 7: 'S', 8: 'S', 9: 'H', 10: 'H', 11: 'S' },
    19: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'Ds', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    20: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    21: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
};

const PAIR_STRATEGY = {
    // Pair value: { dealerUpcard: action }
    2: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    3: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'P', 9: 'H', 10: 'H', 11: 'H' },
    4: { 2: 'H', 3: 'H', 4: 'P', 5: 'P', 6: 'P', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    5: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'D', 8: 'D', 9: 'D', 10: 'H', 11: 'H' },
    6: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
    7: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'P', 9: 'H', 10: 'Rh', 11: 'H' },
    8: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'P', 9: 'P', 10: 'P', 11: 'P' },
    9: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'S', 8: 'P', 9: 'P', 10: 'S', 11: 'S' },
    10: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
    11: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'P', 9: 'P', 10: 'P', 11: 'P' }, // Aces
};

// ============================================================================
// GAME STATE
// ============================================================================

const GameState = {
    // Settings
    settings: {
        dealerRule: 'h17',
        penetration: 0.65,
        cardsPerDrill: 3,
        speed: 'normal'
    },

    // Game components
    shoe: null,
    playerHand: null,
    dealerHand: null,

    // Counting
    runningCount: 0,
    cardsSeenThisRound: [],

    // Session stats
    stats: {
        handsPlayed: 0,
        correctDecisions: 0,
        countChecks: 0,
        countCorrect: 0,
        currentStreak: 0,
        bestStreak: 0
    },

    // Player
    bankroll: 1000,
    currentBet: 0,

    // UI state
    userCount: 0,
    modalCount: 0,
    currentMode: null,

    // Reset for new session
    reset() {
        this.shoe = new Shoe(this.settings.penetration);
        this.playerHand = new Hand();
        this.dealerHand = new Hand();
        this.runningCount = 0;
        this.cardsSeenThisRound = [];
        this.bankroll = 1000;
        this.currentBet = 0;
        this.userCount = 0;
        this.stats = {
            handsPlayed: 0,
            correctDecisions: 0,
            countChecks: 0,
            countCorrect: 0,
            currentStreak: 0,
            bestStreak: 0
        };
    },

    // Update running count
    countCard(card) {
        this.runningCount += card.hiloValue;
        this.cardsSeenThisRound.push(card);
    },

    // True count calculation
    get trueCount() {
        if (this.shoe.decksRemaining <= 0) return 0;
        return this.runningCount / this.shoe.decksRemaining;
    },

    // Check if shuffle needed
    checkShuffle() {
        if (this.shoe.needsShuffle) {
            this.shoe.shuffle();
            this.runningCount = 0;
            return true;
        }
        return false;
    }
};

// ============================================================================
// STRATEGY LOOKUP
// ============================================================================

function getCorrectAction(hand, dealerUpcard, canDouble = true, canSplit = true, canSurrender = true) {
    const dealerValue = dealerUpcard.isAce ? 11 : dealerUpcard.value;

    // Check pairs first
    if (hand.isPair && canSplit) {
        const pairValue = hand.cards[0].isAce ? 11 : hand.cards[0].value;
        const pairAction = PAIR_STRATEGY[pairValue]?.[dealerValue];
        if (pairAction === 'P') return 'split';
        if (pairAction === 'Rh') return canSurrender ? 'surrender' : 'hit';
        // If not splitting, fall through to soft/hard
    }

    const value = hand.value;
    let action;

    if (hand.isSoft && value <= 21) {
        action = SOFT_STRATEGY[value]?.[dealerValue] || 'S';
    } else {
        if (value < 5) action = 'H';
        else if (value > 21) action = 'S';
        else action = HARD_STRATEGY[value]?.[dealerValue] || 'H';
    }

    // Convert action codes
    switch (action) {
        case 'H': return 'hit';
        case 'S': return 'stand';
        case 'D': return canDouble ? 'double' : 'hit';
        case 'Ds': return canDouble ? 'double' : 'stand';
        case 'P': return 'split';
        case 'Rh': return canSurrender ? 'surrender' : 'hit';
        case 'Rs': return canSurrender ? 'surrender' : 'stand';
        default: return 'stand';
    }
}

function isActionCorrect(userAction, hand, dealerUpcard) {
    const correct = getCorrectAction(
        hand,
        dealerUpcard,
        hand.canDouble,
        hand.canSplit,
        hand.canSurrender
    );

    // Handle special cases
    if (correct === 'double' && (userAction === 'double' || userAction === 'hit')) {
        return userAction === 'double' || !hand.canDouble;
    }

    return userAction === correct;
}

// ============================================================================
// GAME ACTIONS
// ============================================================================

function dealInitialCards() {
    GameState.cardsSeenThisRound = [];
    GameState.playerHand.clear();
    GameState.dealerHand.clear();

    // Deal: Player, Dealer (up), Player, Dealer (hole)
    const p1 = GameState.shoe.deal();
    GameState.playerHand.addCard(p1);
    GameState.countCard(p1);

    const d1 = GameState.shoe.deal();
    GameState.dealerHand.addCard(d1);
    GameState.countCard(d1);

    const p2 = GameState.shoe.deal();
    GameState.playerHand.addCard(p2);
    GameState.countCard(p2);

    const d2 = GameState.shoe.deal();
    GameState.dealerHand.addCard(d2);
    // Hole card NOT counted until revealed
}

function revealDealerHoleCard() {
    const holeCard = GameState.dealerHand.cards[1];
    if (holeCard) {
        GameState.countCard(holeCard);
    }
}

function dealerPlay() {
    const dealerRule = GameState.settings.dealerRule;

    while (true) {
        const value = GameState.dealerHand.value;
        const isSoft = GameState.dealerHand.isSoft;

        if (value < 17) {
            const card = GameState.shoe.deal();
            GameState.dealerHand.addCard(card);
            GameState.countCard(card);
        } else if (value === 17 && isSoft && dealerRule === 'h17') {
            const card = GameState.shoe.deal();
            GameState.dealerHand.addCard(card);
            GameState.countCard(card);
        } else {
            break;
        }

        if (GameState.dealerHand.isBusted) break;
    }
}

function determineWinner() {
    const playerValue = GameState.playerHand.value;
    const dealerValue = GameState.dealerHand.value;
    const playerBJ = GameState.playerHand.isBlackjack;
    const dealerBJ = GameState.dealerHand.isBlackjack;

    if (GameState.playerHand.isSurrendered) {
        return { result: 'surrender', payout: GameState.currentBet / 2 };
    }

    if (GameState.playerHand.isBusted) {
        return { result: 'lose', payout: 0 };
    }

    if (playerBJ && dealerBJ) {
        return { result: 'push', payout: GameState.currentBet };
    }

    if (playerBJ) {
        return { result: 'blackjack', payout: GameState.currentBet * 2.5 };
    }

    if (dealerBJ) {
        return { result: 'lose', payout: 0 };
    }

    if (GameState.dealerHand.isBusted) {
        return { result: 'win', payout: GameState.currentBet * 2 };
    }

    if (playerValue > dealerValue) {
        return { result: 'win', payout: GameState.currentBet * 2 };
    } else if (playerValue < dealerValue) {
        return { result: 'lose', payout: 0 };
    } else {
        return { result: 'push', payout: GameState.currentBet };
    }
}

// ============================================================================
// COUNTING DRILL
// ============================================================================

function dealDrillCards() {
    const cards = [];
    const count = GameState.settings.cardsPerDrill;

    for (let i = 0; i < count; i++) {
        if (GameState.shoe.needsShuffle) {
            GameState.shoe.shuffle();
            GameState.runningCount = 0;
        }

        const card = GameState.shoe.deal();
        GameState.countCard(card);
        cards.push(card);
    }

    return cards;
}

// ============================================================================
// STRATEGY DRILL
// ============================================================================

function generateStrategyHand() {
    // Generate a realistic hand for strategy practice
    const deck = new Deck();
    deck.shuffle();

    const playerHand = new Hand();
    const dealerCard = deck.deal();

    // Deal 2 cards to player
    playerHand.addCard(deck.deal());
    playerHand.addCard(deck.deal());

    return { playerHand, dealerCard };
}

// Export
window.GameState = GameState;
window.getCorrectAction = getCorrectAction;
window.isActionCorrect = isActionCorrect;
window.dealInitialCards = dealInitialCards;
window.revealDealerHoleCard = revealDealerHoleCard;
window.dealerPlay = dealerPlay;
window.determineWinner = determineWinner;
window.dealDrillCards = dealDrillCards;
window.generateStrategyHand = generateStrategyHand;
