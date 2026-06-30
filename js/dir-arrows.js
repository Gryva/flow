// Builds the drifting arrow icons behind each direction card's text/cover/icon.
// Values below were tuned live via a temporary debug panel and locked in.

const ICONS = {
  up:   { rotate: 45,  path: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>' },
  down: { rotate: -45, path: '<line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/>' },
  flow: { rotate: 0,   path: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>' },
};

const PARAMS = {
  up:   { rows: 30, spread: 600, speed: 15.4, size: 15, opacity: 0.15, gapMin: 24, gapMax: 102, iconsPerRow: 5 },
  down: { rows: 30, spread: 600, speed: 15.4, size: 15, opacity: 0.15, gapMin: 24, gapMax: 102, iconsPerRow: 5 },
  flow: { rows: 3,  spread: 70,  speed: 15.4, size: 15, opacity: 0.22, gapMin: 14, gapMax: 60,  iconsPerRow: 14 },
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
    const track = document.createElement('div');
    track.className = 'tok-dir-flow-arrows-track';
    track.style.top = top + '%';
    track.style.animationDelay = (-r * p.speed / Math.max(rows, 1)).toFixed(2) + 's';
    track.innerHTML = buildRowHTML(kind, p);
    wrapper.appendChild(track);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  buildWrapper(document.querySelector('.tok-dir-flow-arrows.diag-up'), 'up');
  buildWrapper(document.querySelector('.tok-dir-flow-arrows.diag-down'), 'down');
  buildWrapper(document.querySelector('.tok-dir-flow-arrows:not(.diag-up):not(.diag-down)'), 'flow');
});
