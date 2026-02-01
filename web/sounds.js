/**
 * sounds.js - Sound effects using Web Audio API
 * Generates card dealing and UI sounds
 */

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        this.init();
    }

    init() {
        try {
            // Create audio context on first user interaction
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
            this.enabled = false;
        }
    }

    /**
     * Play card dealing sound - subtle swoosh/snap
     */
    playCardDeal(delay = 0) {
        if (!this.enabled || !this.audioContext) return;

        const ctx = this.audioContext;
        const currentTime = ctx.currentTime + delay;

        // Create oscillator for swoosh sound
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Swoosh frequency sweep
        oscillator.frequency.setValueAtTime(800, currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, currentTime + 0.08);

        // Quick envelope
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.08);

        oscillator.type = 'sine';
        oscillator.start(currentTime);
        oscillator.stop(currentTime + 0.08);

        // Add snap/click at the end
        setTimeout(() => this.playCardSnap(), delay * 1000 + 60);
    }

    /**
     * Play card snap sound - quick click
     */
    playCardSnap() {
        if (!this.enabled || !this.audioContext) return;

        const ctx = this.audioContext;
        const currentTime = ctx.currentTime;

        // White noise for snap
        const bufferSize = ctx.sampleRate * 0.02; // 20ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gainNode = ctx.createGain();

        noise.buffer = buffer;
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        // High-pass filter for crisp snap
        filter.type = 'highpass';
        filter.frequency.value = 800;

        // Quick attack/decay
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, currentTime + 0.001);
        gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.02);

        noise.start(currentTime);
        noise.stop(currentTime + 0.02);
    }

    /**
     * Play chip sound for betting
     */
    playChip() {
        if (!this.enabled || !this.audioContext) return;

        const ctx = this.audioContext;
        const currentTime = ctx.currentTime;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Metallic clink
        oscillator.frequency.setValueAtTime(1200, currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, currentTime + 0.05);

        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, currentTime + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.05);

        oscillator.type = 'triangle';
        oscillator.start(currentTime);
        oscillator.stop(currentTime + 0.05);
    }

    /**
     * Play button click sound
     */
    playClick() {
        if (!this.enabled || !this.audioContext) return;

        const ctx = this.audioContext;
        const currentTime = ctx.currentTime;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = 600;

        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.15, currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.03);

        oscillator.type = 'square';
        oscillator.start(currentTime);
        oscillator.stop(currentTime + 0.03);
    }

    /**
     * Toggle sound on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * Set volume (0 to 1)
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }
}

// Create global sound manager instance
window.soundManager = new SoundManager();

// Initialize audio context on first user interaction
document.addEventListener('click', () => {
    if (window.soundManager && !window.soundManager.audioContext) {
        window.soundManager.init();
    }
}, { once: true });
