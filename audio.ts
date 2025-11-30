
export class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmOsc: OscillatorNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;

  init() {
    if (!this.ctx) {
      // @ts-ignore - Handle webkit prefix for older browsers if needed
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(console.error);
    }
  }

  private createOscillator(type: OscillatorType, freq: number, duration: number, vol: number = 0.1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + duration);
  }

  playCollect() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t); 
    osc.frequency.setValueAtTime(1760, t + 0.1); 
    
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.2);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 0.2);
  }

  playNegative() {
    if (!this.ctx) return;
    this.createOscillator('sawtooth', 150, 0.3, 0.1);
  }

  playCrash() {
    if (!this.ctx) return;
    // Punchy noise
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  playDeath() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  playWin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Major chord arpeggio
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.value = 0.05;
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t + i * 0.1);
        osc.stop(t + 2.0);
    });
  }

  playGameOver() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 1.0);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 1.0);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 1.0);
  }

  startMusic() {
    if (!this.ctx) this.init();
    this.resume();

    if (this.bgmOsc) return;

    this.bgmOsc = this.ctx!.createOscillator();
    this.bgmGain = this.ctx!.createGain();
    this.bgmFilter = this.ctx!.createBiquadFilter();

    this.bgmOsc.type = 'sawtooth';
    this.bgmOsc.frequency.value = 55;

    this.bgmFilter.type = 'lowpass';
    this.bgmFilter.frequency.value = 200; 

    this.bgmGain.gain.value = 0.15;

    this.bgmOsc.connect(this.bgmFilter);
    this.bgmFilter.connect(this.bgmGain);
    this.bgmGain.connect(this.ctx!.destination);

    this.bgmOsc.start();
  }

  stopMusic() {
    if (this.bgmOsc) {
      const t = this.ctx?.currentTime || 0;
      this.bgmGain?.gain.setTargetAtTime(0, t, 0.1);
      
      setTimeout(() => {
        this.bgmOsc?.stop();
        this.bgmOsc?.disconnect();
        this.bgmFilter?.disconnect();
        this.bgmGain?.disconnect();
        this.bgmOsc = null;
        this.bgmFilter = null;
        this.bgmGain = null;
      }, 200);
    }
  }

  updateMusicIntensity(intensity: number) {
    if (this.bgmFilter && this.ctx) {
      const targetFreq = 200 + (intensity * 800); 
      this.bgmFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    }
  }
}

export const audio = new AudioManager();
