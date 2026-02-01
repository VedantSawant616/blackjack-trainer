/**
 * cards.js - Card rendering utilities
 * Creates visual card elements for the UI
 */

// Card suits with symbols and colors
const SUITS = {
    'C': { symbol: '♣', color: 'black', name: 'Clubs' },
    'D': { symbol: '♦', color: 'red', name: 'Diamonds' },
    'H': { symbol: '♥', color: 'red', name: 'Hearts' },
    'S': { symbol: '♠', color: 'black', name: 'Spades' }
};

// Card ranks
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Hi-Lo values
const HILO_VALUES = {
    '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
    '7': 0, '8': 0, '9': 0,
    '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1
};

// Blackjack values
const CARD_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11
};

/**
 * Card class representing a single playing card
 */
class Card {
    constructor(rank, suit) {
        this.rank = rank;
        this.suit = suit;
        this.suitData = SUITS[suit];
    }

    get value() {
        return CARD_VALUES[this.rank];
    }

    get hiloValue() {
        return HILO_VALUES[this.rank];
    }

    get isAce() {
        return this.rank === 'A';
    }

    get isTenValue() {
        return this.value === 10;
    }

    toString() {
        return `${this.rank}${this.suitData.symbol}`;
    }

    /**
     * Create HTML element for this card
     */
    toElement(faceDown = false) {
        const card = document.createElement('div');

        if (faceDown) {
            card.className = 'card face-down';
            return card;
        }

        card.className = `card ${this.suitData.color}`;
        card.innerHTML = `
            <div class="card-corner top">
                <span class="card-rank">${this.rank}</span>
                <span class="card-suit">${this.suitData.symbol}</span>
            </div>
            <div class="card-center">${this.suitData.symbol}</div>
            <div class="card-corner bottom">
                <span class="card-rank">${this.rank}</span>
                <span class="card-suit">${this.suitData.symbol}</span>
            </div>
        `;

        return card;
    }
}

/**
 * Deck class - standard 52-card deck
 */
class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        for (const suit of Object.keys(SUITS)) {
            for (const rank of RANKS) {
                this.cards.push(new Card(rank, suit));
            }
        }
    }

    shuffle() {
        // Fisher-Yates shuffle
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal() {
        if (this.cards.length === 0) {
            throw new Error('Deck is empty');
        }
        return this.cards.pop();
    }

    get remaining() {
        return this.cards.length;
    }

    get dealt() {
        return 52 - this.cards.length;
    }
}

/**
 * Shoe class - manages the deck with penetration
 */
class Shoe {
    constructor(penetration = 0.65) {
        this.penetration = penetration;
        this.deck = new Deck();
        this.shuffle();
    }

    shuffle() {
        this.deck.reset();
        this.deck.shuffle();
    }

    deal() {
        return this.deck.deal();
    }

    get needsShuffle() {
        return (this.deck.dealt / 52) >= this.penetration;
    }

    get remaining() {
        return this.deck.remaining;
    }

    get decksRemaining() {
        return this.deck.remaining / 52;
    }

    get penetrationReached() {
        return this.deck.dealt / 52;
    }
}

/**
 * Hand class - represents a blackjack hand
 */
class Hand {
    constructor() {
        this.cards = [];
        this.isSplit = false;
        this.isDoubled = false;
        this.isSurrendered = false;
        this.isStood = false;
    }

    addCard(card) {
        this.cards.push(card);
    }

    get value() {
        let total = 0;
        let aces = 0;

        for (const card of this.cards) {
            total += card.value;
            if (card.isAce) aces++;
        }

        // Convert aces from 11 to 1 as needed
        while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
        }

        return total;
    }

    get isSoft() {
        let total = 0;
        let aces = 0;

        for (const card of this.cards) {
            total += card.value;
            if (card.isAce) aces++;
        }

        let converted = 0;
        while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
            converted++;
        }

        // Soft if we still have an ace counted as 11
        const originalAces = this.cards.filter(c => c.isAce).length;
        return (originalAces > converted) && total <= 21;
    }

    get isBlackjack() {
        return this.cards.length === 2 && this.value === 21 && !this.isSplit;
    }

    get isBusted() {
        return this.value > 21;
    }

    get isPair() {
        return this.cards.length === 2 && this.cards[0].rank === this.cards[1].rank;
    }

    get isTenPair() {
        return this.cards.length === 2 &&
            this.cards[0].isTenValue &&
            this.cards[1].isTenValue;
    }

    get canDouble() {
        return this.cards.length === 2 && !this.isDoubled && !this.isSplit;
    }

    get canSplit() {
        return this.isPair && !this.isSplit;
    }

    get canSurrender() {
        return this.cards.length === 2 && !this.isDoubled && !this.isSplit;
    }

    get isComplete() {
        return this.isBusted || this.isStood || this.isSurrendered ||
            (this.isDoubled && this.cards.length === 3);
    }

    clear() {
        this.cards = [];
        this.isSplit = false;
        this.isDoubled = false;
        this.isSurrendered = false;
        this.isStood = false;
    }

    toString() {
        const cardsStr = this.cards.map(c => c.toString()).join(' ');
        const soft = this.isSoft ? ' (soft)' : '';
        return `[${cardsStr}] = ${this.value}${soft}`;
    }

    /**
     * Render cards to a container element
     */
    render(container, hideLast = false) {
        container.innerHTML = '';
        this.cards.forEach((card, index) => {
            const faceDown = hideLast && index === this.cards.length - 1 && this.cards.length === 2;
            const el = card.toElement(faceDown);
            el.style.animationDelay = `${index * 0.1}s`;
            container.appendChild(el);

            // Play card dealing sound with delay
            if (window.soundManager) {
                window.soundManager.playCardDeal(index * 0.1);
            }
        });
    }
}

// Export for use in other modules
window.Card = Card;
window.Deck = Deck;
window.Shoe = Shoe;
window.Hand = Hand;
window.HILO_VALUES = HILO_VALUES;
window.CARD_VALUES = CARD_VALUES;
window.SUITS = SUITS;
window.RANKS = RANKS;
