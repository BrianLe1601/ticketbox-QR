class CyberAudio {
  private context: AudioContext | null = null;
  private enabled = false;
  private activeNodes = new Set<AudioScheduledSourceNode>();

  isEnabled() {
    return this.enabled;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.tone(720, 0.08, 0.035, "sine");
    else this.stop();
    return this.enabled;
  }

  private getContext() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType) {
    if (!this.enabled) return;
    const context = this.getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    this.activeNodes.add(oscillator);
    oscillator.addEventListener("ended", () => this.activeNodes.delete(oscillator), { once: true });
  }

  playAccessGranted() {
    this.tone(520, 0.12, 0.045, "sine");
    window.setTimeout(() => this.tone(780, 0.16, 0.04, "sine"), 105);
  }

  playAccessDenied() {
    this.tone(150, 0.22, 0.04, "sawtooth");
  }

  playGateOpening() {
    this.tone(76, 0.7, 0.055, "sawtooth");
    this.tone(112, 0.85, 0.025, "triangle");
  }

  stop() {
    this.activeNodes.forEach((node) => {
      try { node.stop(); } catch { /* node already ended */ }
    });
    this.activeNodes.clear();
  }
}

export const cyberAudio = new CyberAudio();
