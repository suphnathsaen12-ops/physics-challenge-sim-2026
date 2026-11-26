(function () {
  'use strict';

  const STORAGE_KEY = 'ap_challenge_2026_sfx_v1';
  let ctx = null;
  let muted = loadMuted();

  function loadMuted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function saveMuted(val) {
    try {
      localStorage.setItem(STORAGE_KEY, val ? '1' : '0');
    } catch (e) {
      // Ignore storage errors
    }
  }

  function ensureContext() {
    if (muted) return null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended' && ctx.resume) {
        ctx.resume().catch(function () {});
      }
      return ctx;
    } catch (e) {
      return null;
    }
  }

  function createNoiseBuffer(audioCtx, durationSec) {
    const length = Math.max(1, Math.floor(audioCtx.sampleRate * durationSec));
    const buf = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function push() {
    const ac = ensureContext();
    if (!ac) return;
    try {
      const now = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = createNoiseBuffer(ac, 0.26);

      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(1.8, now);
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(1150, now + 0.22);

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);
      src.start(now);
      src.stop(now + 0.26);
    } catch (e) {}
  }

  function impact() {
    const ac = ensureContext();
    if (!ac) return;
    try {
      const now = ac.currentTime;

      // Low body thump
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(125, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);

      const gOsc = ac.createGain();
      gOsc.gain.setValueAtTime(0.32, now);
      gOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gOsc);
      gOsc.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.17);

      // Short transient click
      const noise = ac.createBufferSource();
      noise.buffer = createNoiseBuffer(ac, 0.05);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, now);
      bp.Q.setValueAtTime(1.2, now);

      const gNoise = ac.createGain();
      gNoise.gain.setValueAtTime(0.22, now);
      gNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      noise.connect(bp);
      bp.connect(gNoise);
      gNoise.connect(ac.destination);
      noise.start(now);
      noise.stop(now + 0.05);
    } catch (e) {}
  }

  function launch() {
    const ac = ensureContext();
    if (!ac) return;
    try {
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.08);

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.10);
    } catch (e) {}
  }

  function success() {
    const ac = ensureContext();
    if (!ac) return;
    try {
      const notes = [523.25, 659.25, 783.99]; // C5 - E5 - G5
      const now = ac.currentTime;
      for (let i = 0; i < notes.length; i += 1) {
        const t = now + i * 0.085;
        const osc = ac.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(notes[i], t);

        const gain = ac.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.30);
      }
    } catch (e) {}
  }

  function fail() {
    const ac = ensureContext();
    if (!ac) return;
    try {
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(112, now + 0.34);

      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(420, now);

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(lp);
      lp.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  }

  function updateButton() {
    const btn = document.getElementById('btnSound');
    if (!btn) return;
    btn.classList.toggle('active', !muted);
    btn.classList.toggle('alt-active', muted);
    btn.textContent = muted ? '🔇 ปิด' : '🔊 เสียง';
    btn.title = muted ? 'เปิดเสียงประกอบเอฟเฟกต์' : 'ปิดเสียงประกอบเอฟเฟกต์';
  }

  function isMuted() {
    return muted;
  }

  function setMuted(val) {
    muted = Boolean(val);
    saveMuted(muted);
    if (!muted) ensureContext();
    updateButton();
  }

  function toggle() {
    setMuted(!muted);
    return !muted;
  }

  function initUI() {
    updateButton();
    const btn = document.getElementById('btnSound');
    if (btn && !btn.dataset.sfxBound) {
      btn.dataset.sfxBound = '1';
      btn.addEventListener('click', toggle);
    }
  }

  window.Sfx = {
    push: push,
    impact: impact,
    launch: launch,
    success: success,
    fail: fail,
    isMuted: isMuted,
    setMuted: setMuted,
    toggle: toggle,
    initUI: initUI
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
