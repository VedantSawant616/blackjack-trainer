/**
 * payouts.js - Payout animation system
 * Handles visual effects for wins/losses
 */

/**
 * Show payout animation
 * @param {string} result - 'win', 'lose', 'blackjack', 'push'
 * @param {number} amount - Payout amount (positive for win, negative for loss)
 */
function showPayoutAnimation(result, amount) {
    const overlay = document.getElementById('payout-overlay');
    const payoutText = document.getElementById('payout-text');
    const payoutAmount = document.getElementById('payout-amount');

    if (!overlay || !payoutText || !payoutAmount) return;

    // Set text based on result
    const messages = {
        'win': 'WIN!',
        'lose': 'LOSE',
        'blackjack': 'BLACKJACK!',
        'push': 'PUSH',
        'surrender': 'SURRENDERED'
    };

    payoutText.textContent = messages[result] || result.toUpperCase();

    // Set amount
    const prefix = amount > 0 ? '+' : '';
    payoutAmount.textContent = `${prefix}$${Math.abs(amount)}`;
    payoutAmount.className = 'payout-amount' + (amount < 0 ? ' negative' : '');

    // Reset classes
    overlay.className = 'payout-overlay';

    // Add result-specific class
    overlay.classList.add(result);
    overlay.classList.add('active');

    // Add screen effects
    if (result === 'win' || result === 'blackjack') {
        createWinFlash();
        if (amount > 0) {
            createFlyingCoins(Math.min(Math.floor(amount / 10), 15));
        }
    } else if (result === 'lose') {
        createLoseShake();
    }

    // Remove after animation
    setTimeout(() => {
        overlay.classList.remove('active');
    }, 2000);

    setTimeout(() => {
        overlay.className = 'payout-overlay';
    }, 2500);
}

/**
 * Create flying coins animation
 */
function createFlyingCoins(count = 10) {
    const container = document.body;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    for (let i = 0; i < count; i++) {
        const coin = document.createElement('div');
        coin.className = 'payout-coin';

        // Random target position
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const distance = 200 + Math.random() * 150;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        coin.style.left = centerX + 'px';
        coin.style.top = centerY + 'px';
        coin.style.setProperty('--tx', `${tx}px`);
        coin.style.setProperty('--ty', `${ty}px`);
        coin.style.animationDelay = `${i * 0.05}s`;

        container.appendChild(coin);
        coin.classList.add('fly');

        // Remove after animation
        setTimeout(() => {
            coin.remove();
        }, 1000 + (i * 50));
    }
}

/**
 * Create win flash effect
 */
function createWinFlash() {
    const flash = document.createElement('div');
    flash.className = 'win-flash';
    document.body.appendChild(flash);

    setTimeout(() => {
        flash.remove();
    }, 600);
}

/**
 * Create lose shake effect
 */
function createLoseShake() {
    const app = document.getElementById('app');
    if (app) {
        app.classList.add('lose-shake');
        setTimeout(() => {
            app.classList.remove('lose-shake');
        }, 500);
    }
}

// Export for use in other modules
window.showPayoutAnimation = showPayoutAnimation;
