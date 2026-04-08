const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

export class AudioAnalyzer {
  context: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  dataArray: Uint8Array | null = null;
  
  volume = 0;
  pitchJitter = 0;
  silenceTime = 0;
  speakTime = 0;
  stutter = 0;

  // UI Data Overlay states
  uiVolume = 0;
  uiStability = 1;
  uiTension = 0;
  uiPitchJitter = 0;
  uiState = 'AWAITING';

  isInitialized = false;

  async init() {
    if (this.isInitialized) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.context = new AudioContext();
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      const source = this.context.createMediaStreamSource(stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isInitialized = true;
    } catch (err) {
      console.error("Failed to get microphone access", err);
    }
  }

  update(dt: number) {
    if (!this.isInitialized || !this.analyser || !this.dataArray) return;

    this.analyser.getByteFrequencyData(this.dataArray);
    
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const currentVolume = sum / this.dataArray.length / 255.0;

    // MOTION SMOOTHING + INERTIA (lerp instead of direct drive)
    this.volume = lerp(this.volume, currentVolume, 0.05);

    const isSpeakingNow = currentVolume > 0.03;

    if (isSpeakingNow) {
      // Slow recovery instead of instant snap
      this.silenceTime = lerp(this.silenceTime, 0, 0.02);
      this.speakTime += dt;
    } else {
      this.silenceTime += dt;
      this.speakTime = Math.max(0, this.speakTime - dt * 2.0);
    }

    // LOW FREQUENCY DOMINANCE
    let diffSum = 0;
    for (let i = 1; i < 50; i++) { // Only look at very low frequencies
      diffSum += Math.abs(this.dataArray[i] - this.dataArray[i - 1]);
    }
    const currentJitter = diffSum / 50 / 255.0;
    this.pitchJitter = lerp(this.pitchJitter, currentJitter, 0.02); // Very smooth inertia

    // DATA OVERLAY UPDATES (lerped for realism)
    this.uiVolume = lerp(this.uiVolume, this.volume, 0.1);
    let targetStability = isSpeakingNow ? 1.0 - this.pitchJitter : Math.max(0, 1.0 - this.silenceTime * 0.15);
    this.uiStability = lerp(this.uiStability, targetStability, 0.05);
    let targetTension = isSpeakingNow ? Math.min(1.0, this.volume * 3.0 + this.pitchJitter) : 0.0;
    this.uiTension = lerp(this.uiTension, targetTension, 0.05);
    this.uiPitchJitter = lerp(this.uiPitchJitter, this.pitchJitter, 0.05);

    if (!this.isInitialized) this.uiState = 'AWAITING';
    else if (this.silenceTime < 1.5) this.uiState = 'STABLE';
    else if (this.silenceTime < 3.5) this.uiState = 'DEGRADING';
    else this.uiState = 'CRITICAL';
  }
}
