export const RAMPS = {
  classic: ' .,:;i1tfLCG08@',
  dense: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  minimal: ' .:-=+*#%@',
  blocks: ' ░▒▓█',
  binary: ' 01',
  glyphic: ' ·∴∵≡≣▓█',
};

function hexToRgb(hex) {
  if (!hex) return null;
  const h = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  const full =
    h.length === 3 ? h.split('').map((c) => c + c).join('') : h.length === 6 ? h : null;
  if (!full) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function createAsciiEngine({ video, outputCanvas, sampleCanvas }) {
  const sctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  const octx = outputCanvas.getContext('2d', { alpha: false });

  const config = {
    cols: 140,
    ramp: RAMPS.classic,
    color: false,
    invert: false,
    mirror: true,
    noise: false,
    cellAspect: 0.52,
  };

  const theme = {
    peak: { r: 255, g: 217, b: 138 },
    bg: { r: 5, g: 4, b: 2 },
    bgCss: '#050402',
    polarity: 0,
  };

  function refreshTheme() {
    const style = getComputedStyle(document.documentElement);
    const peak = hexToRgb(style.getPropertyValue('--ascii-peak'));
    const bg = hexToRgb(style.getPropertyValue('--ascii-bg'));
    const polarity = parseInt(style.getPropertyValue('--ascii-polarity'), 10) || 0;
    if (peak) theme.peak = peak;
    if (bg) {
      theme.bg = bg;
      theme.bgCss = `rgb(${bg.r},${bg.g},${bg.b})`;
    }
    theme.polarity = polarity;
  }

  const stats = {
    fps: 0,
    luma: 0,
    lumaStd: 0,
    rows: 0,
    cols: 140,
    histogram: new Array(8).fill(0),
  };

  function setConfig(partial) {
    Object.assign(config, partial);
  }

  function drawFrame() {
    if (video.readyState < 2 || !video.videoWidth) return;

    const videoAR = video.videoWidth / video.videoHeight;
    const cols = config.cols;
    const rows = Math.max(1, Math.round((cols / videoAR) * config.cellAspect));

    sampleCanvas.width = cols;
    sampleCanvas.height = rows;
    sctx.save();
    if (config.mirror) {
      sctx.translate(cols, 0);
      sctx.scale(-1, 1);
    }
    sctx.drawImage(video, 0, 0, cols, rows);
    sctx.restore();

    const { data } = sctx.getImageData(0, 0, cols, rows);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = outputCanvas.clientWidth;
    const cssH = outputCanvas.clientHeight;

    const cellW = cssW / cols;
    const cellH = cellW / config.cellAspect;
    const totalH = cellH * rows;
    const offsetY = (cssH - totalH) / 2;

    if (outputCanvas.width !== cssW * dpr || outputCanvas.height !== cssH * dpr) {
      outputCanvas.width = cssW * dpr;
      outputCanvas.height = cssH * dpr;
    }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);

    octx.fillStyle = theme.bgCss;
    octx.fillRect(0, 0, cssW, cssH);

    const fontSize = cellH * 1.2;
    octx.font = `${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
    octx.textBaseline = 'middle';
    octx.textAlign = 'center';

    const ramp = config.ramp;
    const rLen = ramp.length - 1;

    let lumaSum = 0;
    let lumaSqSum = 0;
    const hist = [0, 0, 0, 0, 0, 0, 0, 0];
    const total = cols * rows;

    const color = config.color;
    const invert = config.invert;
    const noise = config.noise;
    const polarity = theme.polarity;
    const peak = theme.peak;
    const bg = theme.bg;

    for (let y = 0; y < rows; y++) {
      const py = offsetY + y * cellH + cellH / 2;
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        lumaSum += lum;
        lumaSqSum += lum * lum;
        hist[Math.min(7, (lum * 8) | 0)]++;

        // density: how "inked" this cell should be (0 = invisible, 1 = full)
        let d = invert ? 1 - lum : lum;
        if (polarity) d = 1 - d;
        if (noise) {
          d += (Math.random() - 0.5) * 0.35;
          d = d < 0 ? 0 : d > 1 ? 1 : d;
        }

        const ch = ramp[Math.min(rLen, (d * (rLen + 1)) | 0)];
        if (ch === ' ' || ch === undefined) continue;

        if (color) {
          // sample video RGB, then lerp from bg toward the sampled color by d
          const sr = invert ? 255 - r : r;
          const sg = invert ? 255 - g : g;
          const sb = invert ? 255 - b : b;
          const tt = Math.pow(d, 0.85);
          const rr = (bg.r + (sr - bg.r) * tt) | 0;
          const gg = (bg.g + (sg - bg.g) * tt) | 0;
          const bb = (bg.b + (sb - bg.b) * tt) | 0;
          octx.fillStyle = `rgb(${rr},${gg},${bb})`;
        } else {
          const tt = Math.pow(d, 0.85);
          const rr = (bg.r + (peak.r - bg.r) * tt) | 0;
          const gg = (bg.g + (peak.g - bg.g) * tt) | 0;
          const bb = (bg.b + (peak.b - bg.b) * tt) | 0;
          octx.fillStyle = `rgb(${rr},${gg},${bb})`;
        }

        const px = x * cellW + cellW / 2;
        octx.fillText(ch, px, py);
      }
    }

    stats.luma = lumaSum / total;
    stats.lumaStd = Math.sqrt(Math.max(0, lumaSqSum / total - stats.luma * stats.luma));
    stats.histogram = hist;
    stats.rows = rows;
    stats.cols = cols;
  }

  function drawIdle() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = outputCanvas.clientWidth;
    const cssH = outputCanvas.clientHeight;
    if (outputCanvas.width !== cssW * dpr || outputCanvas.height !== cssH * dpr) {
      outputCanvas.width = cssW * dpr;
      outputCanvas.height = cssH * dpr;
    }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.fillStyle = theme.bgCss;
    octx.fillRect(0, 0, cssW, cssH);

    const cols = 100;
    const cellW = cssW / cols;
    const cellH = cellW / config.cellAspect;
    const rows = Math.floor(cssH / cellH);
    const fontSize = cellH * 1.2;
    octx.font = `${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
    octx.textBaseline = 'middle';
    octx.textAlign = 'center';

    const glyphs = '·.· ∴∵ ░▒▓ 01 |/\\_ ';
    const t = performance.now() * 0.001;
    const peak = theme.peak;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const n = pseudoNoise(x, y, t);
        if (n < 0.55) continue;
        const ch = glyphs[((n * glyphs.length * 7) | 0) % glyphs.length];
        const alpha = (n - 0.55) * 0.8;
        octx.fillStyle = `rgba(${peak.r}, ${peak.g}, ${peak.b}, ${alpha.toFixed(3)})`;
        octx.fillText(ch, x * cellW + cellW / 2, y * cellH + cellH / 2);
      }
    }

    // center scanline sweep
    const sweepY = (Math.sin(t * 0.6) * 0.5 + 0.5) * cssH;
    const grad = octx.createLinearGradient(0, sweepY - 40, 0, sweepY + 40);
    grad.addColorStop(0, `rgba(${peak.r}, ${peak.g}, ${peak.b}, 0)`);
    grad.addColorStop(0.5, `rgba(${peak.r}, ${peak.g}, ${peak.b}, 0.08)`);
    grad.addColorStop(1, `rgba(${peak.r}, ${peak.g}, ${peak.b}, 0)`);
    octx.fillStyle = grad;
    octx.fillRect(0, sweepY - 40, cssW, 80);
  }

  function pseudoNoise(x, y, t) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + t * 3.7) * 43758.5453;
    return s - Math.floor(s);
  }

  let lastTime = performance.now();
  let frames = 0;
  let fpsAcc = 0;
  let mode = 'idle'; // 'idle' | 'live' | 'stopped'

  function loop() {
    if (mode === 'stopped') return;
    if (mode === 'live') drawFrame();
    else drawIdle();

    frames++;
    const now = performance.now();
    fpsAcc += now - lastTime;
    lastTime = now;
    if (fpsAcc >= 500) {
      stats.fps = Math.round((frames * 1000) / fpsAcc);
      frames = 0;
      fpsAcc = 0;
    }
    requestAnimationFrame(loop);
  }

  refreshTheme();

  return {
    startIdle() {
      if (mode === 'stopped') mode = 'idle';
      if (mode === 'idle') {
        lastTime = performance.now();
        requestAnimationFrame(loop);
      }
    },
    startLive() {
      const wasStopped = mode === 'stopped';
      mode = 'live';
      lastTime = performance.now();
      if (wasStopped) requestAnimationFrame(loop);
    },
    stop() {
      mode = 'stopped';
    },
    setConfig,
    refreshTheme,
    getStats: () => stats,
    getConfig: () => ({ ...config }),
  };
}
