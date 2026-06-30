// Builds the drifting arrow icons behind each direction card's text/cover/icon.
// Values below were tuned live and locked in. Each card's arrows only animate
// once that direction is the chosen one (see .tok-dir.chosen in style.css).
// v2 — pulse race-condition fix via per-direction generation counter.

const ICONS = {
  up:   { rotate: 45,  path: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>' },
  down: { rotate: -45, path: '<line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/>' },
  flow: { rotate: 0,   path: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>' },
};

const PARAMS = {
  up:   { rows: 30, spread: 600, speed: 15.5, size: 15, opacity: 0.18,  gapMin: 24, gapMax: 102, iconsPerRow: 5 },
  down: { rows: 30, spread: 600, speed: 15.5, size: 15, opacity: 0.18,  gapMin: 24, gapMax: 102, iconsPerRow: 5 },
  flow: { rows: 3,  spread: 70,  speed: 26,   size: 15, opacity: 0.264, gapMin: 14, gapMax: 60,  iconsPerRow: 14 },
};

function svgFor(kind, gap, jitter){
  const icon = ICONS[kind];
  return `<svg style="margin-right:${gap}px; transform:rotate(${icon.rotate}deg) translateY(${jitter}px)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon.path}</svg>`;
}

function buildRowHTML(kind, p){
  const seq = [];
  for (let i = 0; i < p.iconsPerRow; i++){
    const gap = p.gapMin + Math.random() * (p.gapMax - p.gapMin);
    const jitter = (Math.random() * 12 - 6);
    seq.push(svgFor(kind, gap.toFixed(1), jitter.toFixed(1)));
  }
  // duplicate the sequence so the translateX(-50%)->translateX(0%) loop tiles seamlessly
  return seq.join('') + seq.join('');
}

function buildWrapper(wrapper, kind){
  if (!wrapper) return;
  const p = PARAMS[kind];
  wrapper.style.setProperty('--tok-arrow-size', p.size + 'px');
  wrapper.style.setProperty('--tok-arrow-opacity', p.opacity);
  wrapper.style.setProperty('--tok-arrow-speed', p.speed + 's');
  wrapper.innerHTML = '';
  const rows = p.rows;
  const half = p.spread / 2;
  for (let r = 0; r < rows; r++){
    const top = rows === 1 ? 50 : 50 - half + (half * 2 * r) / (rows - 1);
    const row = document.createElement('div');
    row.className = 'tok-dir-flow-arrows-row';
    row.style.top = top + '%';
    const track = document.createElement('div');
    track.className = 'tok-dir-flow-arrows-track';
    track.style.animationDelay = (-r * p.speed / Math.max(rows, 1)).toFixed(2) + 's';
    track.innerHTML = buildRowHTML(kind, p);
    row.appendChild(track);
    wrapper.appendChild(row);
  }
}

function wrapperFor(kind){
  if (kind === 'up') return document.querySelector('.tok-dir-flow-arrows.diag-up');
  if (kind === 'down') return document.querySelector('.tok-dir-flow-arrows.diag-down');
  return document.querySelector('.tok-dir-flow-arrows:not(.diag-up):not(.diag-down)');
}

// Brief "selection pulse": on pick, arrows jump to ~2.8x speed and ~3x
// opacity, then ease back down to the locked-in defaults over ~1.75s —
// a clear extra cue that the direction just changed.
//
// Speed is driven via Animation.playbackRate rather than by changing
// --tok-arrow-speed (animation-duration): CSS animations derive their
// current position from total elapsed time divided by duration, so
// shrinking then growing the duration mid-flight recomputes that phase
// and makes the icons visibly jump backward. playbackRate just scales how
// fast time advances from wherever the animation currently is, so it
// speeds up and settles back down without ever reversing.
const PULSE = {
  rateFactor: 2.8,      // how much faster at peak
  opacityFactor: 3,     // how much brighter at peak, multiplies the default opacity
  durationMs: 1750,
};

const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tracks the active pulse "generation" per direction so that re-triggering a
// pulse (e.g. clicking the same card again before the previous pulse has
// eased out) cancels the in-flight one instead of running two rAF loops in
// parallel — two loops fighting over the same playbackRate/opacity produced
// a visible jump/stagger partway through the animation.
const pulseGen = { up: 0, down: 0, flow: 0 };

function pulse(kind){
  if (prefersReducedMotion) return;
  const wrapper = wrapperFor(kind);
  if (!wrapper) return;
  const p = PARAMS[kind];
  const tracks = wrapper.querySelectorAll('.tok-dir-flow-arrows-track');
  // Disable the CSS opacity transition for the duration of the pulse so it
  // doesn't fight the per-frame values driven here.
  tracks.forEach(track => { track.style.transition = 'none'; });

  const anims = Array.from(tracks).flatMap(track => track.getAnimations());
  const peakOpacity = Math.min(p.opacity * PULSE.opacityFactor, 1);
  const gen = ++pulseGen[kind];

  // A card that's just been switched from paused to running has a *pending*
  // animation: its start time isn't committed yet. Writing playbackRate
  // every frame while pending cancels and re-queues that start task each
  // time, so the animation never actually commits and looks frozen. Wait
  // for it to actually start before driving playbackRate.
  Promise.all(anims.map(anim => anim.ready)).then(() => {
    if (gen !== pulseGen[kind]) return;
    const start = performance.now();
    const duration = PULSE.durationMs;
    const rateFactor = PULSE.rateFactor;

    function step(now){
      if (gen !== pulseGen[kind]) return;
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const rate = rateFactor + (1 - rateFactor) * ease;
      const opacity = peakOpacity + (p.opacity - peakOpacity) * ease;
      anims.forEach(anim => { anim.playbackRate = rate; });
      wrapper.style.setProperty('--tok-arrow-opacity', opacity.toFixed(3));
      if (t < 1){
        requestAnimationFrame(step);
      } else {
        anims.forEach(anim => { anim.playbackRate = 1; });
        tracks.forEach(track => { track.style.transition = ''; });
      }
    }
    requestAnimationFrame(step);
  });
}

window.tokPulseDirArrows = pulse;

// Backgrounded tab: an infinite CSS animation otherwise keeps ticking (and
// the compositor keeps re-rendering it) even when nothing is visible,
// which costs battery for zero benefit. Pause it outright while hidden.
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('tok-bg-paused', document.hidden);
});

document.addEventListener('DOMContentLoaded', () => {
  buildWrapper(document.querySelector('.tok-dir-flow-arrows.diag-up'), 'up');
  buildWrapper(document.querySelector('.tok-dir-flow-arrows.diag-down'), 'down');
  buildWrapper(document.querySelector('.tok-dir-flow-arrows:not(.diag-up):not(.diag-down)'), 'flow');
});
