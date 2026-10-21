/**
 * Small, self-contained Web Audio score. No downloads, speech voices, setTimeout
 * or setInterval are needed: the game frame advances the musical sequencer.
 * One context and a fixed voice bank are retained across races. stop() cancels
 * every envelope and suspends the context, including its looping noise source.
 */
export class AudioSystem {
  constructor() {
    this.enabled = true;
    this.context = null;
    this._active = false;
    this._lastPhase = 'menu';
    this._lastStage = '';
    this._scene = null;
    this._carryCueAt = -Infinity;
    this._nextBeat = 0;
    this._beat = 0;
    this._voiceIndex = 0;
    this._gains = [];
  }

  async start() {
    if (!this.enabled) return false;
    try {
      if (!this.context) this._buildGraph();
      if (!this.context) return false; // Browser does not provide Web Audio.
      this._active = true;
      if (this.context.state === 'suspended') await this.context.resume();
      if (!this._active || !this.enabled) {
        if (this.context.state === 'running') await this.context.suspend();
        return false;
      }
      this._level(this.master.gain, .65, .025);
      return this.context.state === 'running';
    } catch {
      // Audio permission/device failure must never prevent starting a race.
      this._active = false;
      return false;
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.stop();
  }

  _buildGraph() {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return;
    const ctx = this.context = new Context({latencyHint: 'interactive'});
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 12;
    limiter.ratio.value = 5;
    limiter.attack.value = .003;
    limiter.release.value = .2;
    this.master.connect(limiter); limiter.connect(ctx.destination);

    this.motor = this._voice('sawtooth', 67);
    this.motorLow = this._voice('triangle', 33.5);
    this.motorFilter = ctx.createBiquadFilter();
    this.motorFilter.type = 'lowpass'; this.motorFilter.frequency.value = 420;
    this.motor.oscillator.disconnect();
    this.motor.oscillator.connect(this.motorFilter);
    this.motorFilter.connect(this.motor.gain);
    this.brake = this._voice('triangle', 620);
    this.city = this._voice('sine', 174.61);
    this.music = Array.from({length: 3}, () => this._voice('triangle', 440));
    this.cues = Array.from({length: 4}, () => this._voice('sine', 440));

    // A short, deterministic noise buffer is shared by wind, rain and impacts.
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 81173, smooth = 0;
    for (let i = 0; i < samples.length; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      const white = seed / 2147483648 - 1;
      smooth = smooth * .65 + white * .35;
      samples[i] = smooth;
    }
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buffer; this.noise.loop = true;
    this.wind = this._noiseChannel('lowpass', 750, .5);
    this.rain = this._noiseChannel('highpass', 1050, .5);
    this.impact = this._noiseChannel('lowpass', 850, .9);
    this.noise.start();
  }

  _voice(type, frequency) {
    const ctx = this.context;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    gain.gain.value = 0;
    oscillator.connect(gain); gain.connect(this.master); oscillator.start();
    this._gains.push(gain.gain);
    return {oscillator, gain};
  }

  _noiseChannel(type, frequency, q) {
    const ctx = this.context, filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
    gain.gain.value = 0;
    this.noise.connect(filter); filter.connect(gain); gain.connect(this.master);
    this._gains.push(gain.gain);
    return {filter, gain};
  }

  _level(parameter, value, smoothing = .07) {
    const t = this.context.currentTime;
    parameter.setTargetAtTime(Number.isFinite(value) ? value : 0, t, smoothing);
  }

  _note(voice, frequency, when, duration, volume) {
    const gain = voice.gain.gain;
    voice.oscillator.frequency.setValueAtTime(frequency, when);
    gain.cancelScheduledValues(when);
    gain.setValueAtTime(0, when);
    gain.linearRampToValueAtTime(volume, when + .012);
    gain.exponentialRampToValueAtTime(.0001, when + duration);
    gain.setValueAtTime(0, when + duration + .01);
  }

  _cue(notes, spacing = .12, volume = .055, duration = .35) {
    const t = this.context.currentTime + .015;
    notes.forEach((frequency, index) => {
      this._note(this.cues[index % this.cues.length], frequency,
        t + index * spacing, duration, volume);
    });
  }

  /** Main calls this once per frame with the engine's authoritative state. */
  update(state) {
    if (!state) return;
    const phase = state.phase;
    const previousPhase = this._lastPhase;
    this._lastPhase = phase;
    if (!['race', 'countdown', 'cutscene'].includes(phase) || !this.enabled) {
      this.stop();
      if (phase !== 'paused') {this._lastStage = ''; this._scene = null;}
      return;
    }
    if (!this.context) return; // Initialize only after start() from a user gesture.
    if (!this._active) void this.start();
    if (!this._active) return;
    const now = this.context.currentTime;
    const racing = phase === 'race', warming = phase === 'countdown';
    const player = state.player || {};
    const speed = Math.max(0, Number(player.speed) || 0);
    const throttle = Math.max(0, Math.min(1, Number(player.throttle) || 0));
    const brake = Math.max(0, Math.min(1, Number(player.brake) || 0));
    const rpm = Number(player.rpm) || (1500 + speed * 145 + throttle * 1100);
    const motorHz = Math.max(28, Math.min(210, rpm / 52));
    this._level(this.motor.oscillator.frequency, motorHz, .045);
    this._level(this.motorLow.oscillator.frequency, motorHz / 2, .045);
    this._level(this.motorFilter.frequency, 330 + throttle * 400 + speed * 9, .08);
    this._level(this.motor.gain.gain, racing ? .024 + throttle * .022 : warming ? .018 : 0);
    this._level(this.motorLow.gain.gain, racing || warming ? .028 + throttle * .015 : 0);
    this._level(this.wind.gain.gain, racing ? Math.min(.16, speed * speed / 18000) : 0, .15);
    this._level(this.brake.gain.gain, racing && speed > 5 ? brake * Math.min(.023, speed * .00055) : 0, .035);
    this._level(this.brake.oscillator.frequency, 540 + speed * 11, .07);
    const rainy = state.environment?.weather === 'rain';
    this._level(this.rain.gain.gain, rainy ? phase === 'cutscene' ? .055 : .09 : 0, .25);
    this._level(this.city.gain.gain, phase === 'cutscene' ? .0015 : .003, .25);

    if (phase === 'cutscene') {
      this._silenceMusic();
      if (this._scene !== state.cutscene) {
        this._scene = state.cutscene;
        this._lastStage = '';
        if (now - this._carryCueAt > .5) this.event('carry');
      }
      const stage = state.cutscene?.stage || '';
      if (stage === 'kiss' && this._lastStage !== 'kiss') this.event('kiss');
      this._lastStage = stage;
      return;
    }
    this._lastStage = '';
    this._scene = null;
    if (previousPhase === 'cutscene') this._silenceCues();
    if (!racing) {this._silenceMusic(); return;}
    if (previousPhase !== 'race') {this._nextBeat = now + .1; this._beat = 0;}
    // Subtle pentatonic tune, one bounded scheduling step per rendered frame.
    if (now >= this._nextBeat) {
      const melody = [72, 76, 79, 76, 81, 79, 76, 74, 72, 74, 76, 79, 76, 74, 69, 67];
      const semitone = melody[this._beat % melody.length];
      const voice = this.music[this._beat % this.music.length];
      this._note(voice, 440 * 2 ** ((semitone - 69) / 12), now + .015, .24, .015);
      this._beat++;
      this._nextBeat = now + .3;
    }
  }

  /** Supported events: pickup, collision (light/medium/severe), carry, kiss,
   * checkpoint, finish, countdown. Severity also accepts an event-detail object. */
  event(type, severity = 'light') {
    if (!this.enabled || !this.context || !this._active) return;
    if (typeof severity === 'object') severity = severity?.severity || 'light';
    const t = this.context.currentTime;
    if (type === 'collision') {
      const strength = typeof severity === 'number' ? Math.max(0, Math.min(1, severity))
        : severity === 'severe' ? 1 : severity === 'medium' ? .55 : .2;
      const gain = this.impact.gain.gain;
      gain.cancelScheduledValues(t); gain.setValueAtTime(0, t);
      gain.linearRampToValueAtTime(.09 + strength * .25, t + .008);
      gain.exponentialRampToValueAtTime(.0001, t + .1 + strength * .25);
      gain.setValueAtTime(0, t + .38);
      this.impact.filter.frequency.setValueAtTime(350 + strength * 750, t);
    } else if (type === 'pickup') {
      this._cue([659.25, 987.77], .075, .04, .22);
    } else if (type === 'checkpoint') {
      this._cue([523.25, 659.25], .06, .022, .15);
    } else if (type === 'carry') {
      if (t - this._carryCueAt < .5) return;
      this._carryCueAt = t;
      this._cue([392, 493.88, 587.33, 783.99], .16, .037, .62);
    } else if (type === 'kiss') {
      this._cue([659.25, 830.61, 987.77, 1318.51], .14, .032, .7);
    } else if (type === 'finish') {
      this._cue([523.25, 659.25, 783.99, 1046.5], .09, .045, .5);
    } else if (type === 'countdown') {
      this._cue([523.25], .1, .03, .12);
    }
  }

  _silenceMusic() {
    const t = this.context.currentTime;
    for (const voice of this.music) {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(0, t);
    }
    this._nextBeat = t + .1;
  }

  _silenceCues() {
    const t = this.context.currentTime;
    for (const voice of this.cues) {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(0, t);
    }
  }

  /** Synchronous silence first; suspension then halts all graph processing.
   * No nodes, musical envelopes or frame-independent timers are left running. */
  stop() {
    if (!this.context || !this._active) return;
    this._active = false;
    const t = this.context.currentTime;
    for (const parameter of [this.master.gain, ...this._gains]) {
      parameter.cancelScheduledValues(t); parameter.setValueAtTime(0, t);
    }
    this._nextBeat = t + .1;
    this._carryCueAt = -Infinity;
    // Retain the scene identity so pausing/resuming cannot replay a kiss cue.
    // Do not create/close contexts on every pause: retain exactly one graph.
    if (this.context.state === 'running') void this.context.suspend().catch(() => {});
  }
}
