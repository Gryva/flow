// Detects a long-press on rows inside `container` (matching `rowSelector`)
// without hijacking normal taps/scrolling, and invokes onLongPress(row).

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 12;

export function attachLongPress(container, rowSelector, onLongPress){
  let timer = null;
  let activeRow = null;
  let start = null;

  function cancel(){
    if (timer) clearTimeout(timer);
    timer = null;
    activeRow = null;
    start = null;
  }

  container.addEventListener('contextmenu', (e) => {
    if (e.target.closest(rowSelector)) e.preventDefault();
  });
  container.addEventListener('pointerdown', (e) => {
    const row = e.target.closest(rowSelector);
    if (!row) return;
    activeRow = row;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      if (!activeRow) return;
      activeRow.dataset.longPressed = '1';
      if (navigator.vibrate) navigator.vibrate(16);
      onLongPress(activeRow);
      timer = null;
      activeRow = null;
      start = null;
    }, LONG_PRESS_MS);
  });
  container.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_TOLERANCE) cancel();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt => {
    container.addEventListener(evt, cancel);
  });
}
