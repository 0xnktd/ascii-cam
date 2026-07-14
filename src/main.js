import { createAsciiEngine, RAMPS } from './ascii.js';

const video = document.getElementById('video');
const asciiCanvas = document.getElementById('ascii-canvas');
const sampleCanvas = document.getElementById('sample-canvas');

const engine = createAsciiEngine({
  video,
  outputCanvas: asciiCanvas,
  sampleCanvas,
});

const densityInput = document.getElementById('density');
const densityValue = document.getElementById('density-value');
const rampTabs = document.getElementById('ramp-tabs');
const rampPreview = document.getElementById('ramp-preview');
const colorToggle = document.getElementById('color');
const invertToggle = document.getElementById('invert');
const mirrorToggle = document.getElementById('mirror');
const fpsEl = document.getElementById('fps');
const gridEl = document.getElementById('grid');
const meanLumaEl = document.getElementById('mean-luma');
const lumaSpreadEl = document.getElementById('luma-spread');
const timestampEl = document.getElementById('timestamp');
const sessionEl = document.getElementById('session');
const histogramEls = document.querySelectorAll('.histogram div');
const snapBtn = document.getElementById('snap');
const recordBtn = document.getElementById('record');
const recordLabel = document.getElementById('record-label');
const copyTextBtn = document.getElementById('copy-text');
const copyTextLabel = document.getElementById('copy-text-label');
const saveTextBtn = document.getElementById('save-text');
const recEl = document.getElementById('rec');
const recTimeEl = document.getElementById('rec-time');
const startCta = document.getElementById('start-cta');

/* ── session ──────────────────────────────────────────────── */
const sessionId = Math.random().toString(16).slice(2, 8).toUpperCase().padEnd(6, '0');
sessionEl.textContent = `SESSION 0X${sessionId}`;

/* ── theme ────────────────────────────────────────────────── */
const THEME_KEY = 'phosphor-theme';
const VALID_THEMES = ['phosphor', 'emerald', 'ice', 'vapor', 'bone', 'paper'];
const themeTabs = document.getElementById('theme-tabs');

function applyTheme(name, { persist = true } = {}) {
  if (!VALID_THEMES.includes(name)) name = 'phosphor';
  document.documentElement.dataset.theme = name;
  themeTabs.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.theme === name);
  });
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, name);
    } catch {}
  }
  engine.refreshTheme();
}

let storedTheme = 'phosphor';
try {
  storedTheme = localStorage.getItem(THEME_KEY) || 'phosphor';
} catch {}
applyTheme(storedTheme, { persist: false });

themeTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  applyTheme(btn.dataset.theme);
});

/* ── density ──────────────────────────────────────────────── */
function updateDensityTrack() {
  const min = parseInt(densityInput.min, 10);
  const max = parseInt(densityInput.max, 10);
  const v = parseInt(densityInput.value, 10);
  const pct = ((v - min) / (max - min)) * 100;
  densityInput.style.setProperty('--percent', `${pct}%`);
}
densityInput.addEventListener('input', () => {
  const v = parseInt(densityInput.value, 10);
  densityValue.textContent = v;
  engine.setConfig({ cols: v });
  updateDensityTrack();
});
densityValue.textContent = densityInput.value;
updateDensityTrack();

/* ── ramp ─────────────────────────────────────────────────── */
function setRampPreview(ramp) {
  const trimmed = ramp.replace(/ /g, '·');
  rampPreview.textContent =
    trimmed.length > 42 ? trimmed.slice(0, 20) + '…' + trimmed.slice(-20) : trimmed;
}
setRampPreview(RAMPS.classic);

rampTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  rampTabs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const ramp = RAMPS[btn.dataset.ramp] ?? RAMPS.classic;
  engine.setConfig({ ramp });
  setRampPreview(ramp);
});

/* ── toggles ──────────────────────────────────────────────── */
colorToggle.addEventListener('change', () =>
  engine.setConfig({ color: colorToggle.checked })
);
invertToggle.addEventListener('change', () =>
  engine.setConfig({ invert: invertToggle.checked })
);
mirrorToggle.addEventListener('change', () =>
  engine.setConfig({ mirror: mirrorToggle.checked })
);

/* ── camera ───────────────────────────────────────────────── */
let mediaStream = null;

async function initCamera() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false,
    });
    video.srcObject = mediaStream;
    await video.play();
    document.body.classList.remove('no-video');
    engine.startLive();
  } catch (err) {
    console.error('Camera error:', err);
    const label = startCta.querySelector('.start-cta-label');
    const sub = startCta.querySelector('.start-cta-sub');
    label.textContent = 'Sensor blocked';
    sub.textContent = err.name === 'NotAllowedError' ? 'permission denied — retry' : err.message;
    startCta.style.borderColor = 'var(--rust)';
    startCta.style.color = 'var(--rust)';
  }
}

startCta.addEventListener('click', initCamera);

engine.startIdle();

/* ── stats tick ───────────────────────────────────────────── */
function updateStats() {
  const stats = engine.getStats();
  fpsEl.textContent = String(Math.min(99, stats.fps)).padStart(2, '0');
  gridEl.textContent = `${stats.cols}×${stats.rows || 0}`;
  meanLumaEl.textContent = stats.luma.toFixed(3);
  lumaSpreadEl.textContent = stats.lumaStd.toFixed(3);
  const max = Math.max(...stats.histogram, 1);
  histogramEls.forEach((el, i) => {
    el.style.height = `${(stats.histogram[i] / max) * 100}%`;
  });
  requestAnimationFrame(updateStats);
}
updateStats();

/* ── timestamp ────────────────────────────────────────────── */
function updateTimestamp() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  timestampEl.textContent = `${hh}:${mm}:${ss}`;
}
updateTimestamp();
setInterval(updateTimestamp, 1000);

/* ── snapshot ─────────────────────────────────────────────── */
function capture() {
  if (document.body.classList.contains('no-video')) return;
  const link = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.download = `phosphor-${ts}.png`;
  link.href = asciiCanvas.toDataURL('image/png');
  link.click();
  flashViewport();
}

function flashViewport() {
  const viewport = document.getElementById('viewport');
  viewport.animate(
    [
      { backgroundColor: '#050402' },
      { backgroundColor: 'rgba(255, 217, 138, 0.4)' },
      { backgroundColor: '#050402' },
    ],
    { duration: 180, easing: 'ease-out' }
  );
}

snapBtn.addEventListener('click', capture);

/* ── text export ──────────────────────────────────────────── */
function flashButtonLabel(el, message, duration = 1200) {
  const original = el.textContent;
  el.textContent = message;
  setTimeout(() => {
    el.textContent = original;
  }, duration);
}

async function copyFrameText() {
  if (document.body.classList.contains('no-video')) return;
  const text = engine.getFrameText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    flashButtonLabel(copyTextLabel, 'Copied!');
  } catch (err) {
    console.error('Copy failed:', err);
    flashButtonLabel(copyTextLabel, 'Copy failed');
  }
}

function saveFrameText() {
  if (document.body.classList.contains('no-video')) return;
  const text = engine.getFrameText();
  if (!text) return;
  const link = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.download = `phosphor-${ts}.txt`;
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

copyTextBtn.addEventListener('click', copyFrameText);
saveTextBtn.addEventListener('click', saveFrameText);

/* ── record ───────────────────────────────────────────────── */
let mediaRecorder = null;
let recordChunks = [];
let recordStart = 0;
let recordTimer = null;

function toggleRecord() {
  if (document.body.classList.contains('no-video')) return;
  if (!mediaRecorder || mediaRecorder.state === 'inactive') startRecord();
  else stopRecord();
}

function startRecord() {
  const stream = asciiCanvas.captureStream(30);
  recordChunks = [];

  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';

  try {
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (err) {
    console.error('Recorder init failed:', err);
    return;
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size) recordChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordChunks, { type: mimeType || 'video/webm' });
    const link = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `phosphor-${ts}.webm`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  };

  mediaRecorder.start(100);
  recordStart = performance.now();
  recEl.hidden = false;
  recordBtn.classList.add('recording');
  recordLabel.textContent = 'Stop';
  recordTimer = setInterval(() => {
    const s = Math.floor((performance.now() - recordStart) / 1000);
    recTimeEl.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(
      s % 60
    ).padStart(2, '0')}`;
  }, 200);
}

function stopRecord() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  mediaRecorder.stop();
  clearInterval(recordTimer);
  recEl.hidden = true;
  recordBtn.classList.remove('recording');
  recordLabel.textContent = 'Record';
}

recordBtn.addEventListener('click', toggleRecord);

/* ── keyboard ─────────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, button, textarea, select')) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    capture();
  } else if (e.key === ' ') {
    e.preventDefault();
    toggleRecord();
  } else if (e.key === 'c' || e.key === 'C') {
    colorToggle.checked = !colorToggle.checked;
    colorToggle.dispatchEvent(new Event('change'));
  } else if (e.key === 'i' || e.key === 'I') {
    invertToggle.checked = !invertToggle.checked;
    invertToggle.dispatchEvent(new Event('change'));
  } else if (e.key === 'm' || e.key === 'M') {
    mirrorToggle.checked = !mirrorToggle.checked;
    mirrorToggle.dispatchEvent(new Event('change'));
  } else if (e.key === 't' || e.key === 'T') {
    const current = document.documentElement.dataset.theme || 'phosphor';
    const idx = VALID_THEMES.indexOf(current);
    const next = VALID_THEMES[(idx + 1) % VALID_THEMES.length];
    applyTheme(next);
  }
});

/* ── cleanup ──────────────────────────────────────────────── */
window.addEventListener('beforeunload', () => {
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
});
