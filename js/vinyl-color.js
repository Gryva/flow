// Samples a track's thumbnail to derive an accent color for the vinyl ring
// and waveform, with an in-memory cache keyed by track id.

export const DEFAULT_VINYL_BG = 'conic-gradient(from 0deg, #FF5A3C, #FFC857, #E2401D, #F0883E, #FF5A3C)';
export const DEFAULT_WAVE_ACCENT = '#FFC857';

function rgbToHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d) + (g < b ? 6 : 0);
    else if (max === g) h = ((b - r) / d) + 2;
    else h = ((r - g) / d) + 4;
    h *= 60;
  }
  return { h, s, l };
}

export function createVinylColorPicker(){
  const cache = {};

  function sampleColor(track){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 16; canvas.height = 16;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 16, 16);
          const data = ctx.getImageData(0, 0, 16, 16).data;
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
          const hsl = rgbToHsl(r / n, g / n, b / n);
          const hue = hsl.h.toFixed(0);
          resolve({
            bg: 'conic-gradient(from 0deg, hsl(' + hue + ',80%,50%), hsl(' + hue + ',85%,68%), hsl(' + hue + ',80%,50%), hsl(' + hue + ',85%,68%), hsl(' + hue + ',80%,50%))',
            accent: 'hsl(' + hue + ',85%,60%)'
          });
        } catch (e) { reject(e); } // tainted canvas (no CORS on thumbnail) — keep default
      };
      img.onerror = reject;
      img.src = track.thumb;
    });
  }

  // Resolves the accent for `track`, calling onResolved(color) once sampling
  // finishes — but only if `track` is still the one the caller cares about
  // (checked via isStillCurrent, since sampling is async and the track may
  // have changed by the time it completes).
  return function applyVinylColor(track, isStillCurrent, onResolved){
    if (cache[track.id]) { onResolved(cache[track.id]); return; }
    onResolved({ bg: DEFAULT_VINYL_BG, accent: DEFAULT_WAVE_ACCENT });
    sampleColor(track).then(color => {
      cache[track.id] = color;
      if (isStillCurrent(track)) onResolved(color);
    }).catch(() => {});
  };
}
