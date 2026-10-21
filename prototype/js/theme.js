/* ==========================================================================
   Infinitum — logo color theme feature (logo_upl / colorscheme_upl)
   Samples the pixels of an uploaded restaurant logo, works out its dominant
   brand hue, and derives a full, readable color theme (background, surface,
   borders, accent) from it so the page "ambience" complements the logo.
   Falls back to the default warm-neutral theme for black/white/grey logos.
   ========================================================================== */

const Theme = (() => {
  const DEFAULT_VARS = {
    "--bg": "#faf6f0",
    "--bg-soft": "#f3ece2",
    "--border": "#e7ddcd",
    "--accent": "#b05c3d",
    "--accent-soft": "#f3e2d8",
    "--accent-contrast": "#ffffff"
  };

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) { h = 0; s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }

  function relativeLuminance(h, s, l) {
    // Approximate luminance using the HSL lightness + a saturation bump —
    // good enough to pick a readable black/white text color on the accent.
    return l / 100;
  }

  /**
   * Samples an <img> element's pixels and resolves a brand hue/saturation.
   * Ignores near-white, near-black, and low-saturation (grey) pixels so a
   * logo's actual brand color wins over its background or outline strokes.
   */
  function samplePalette(img) {
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);

    let data;
    try {
      data = ctx.getImageData(0, 0, size, size).data;
    } catch (e) {
      return null; // e.g. tainted canvas from a cross-origin image
    }

    let sumSin = 0, sumCos = 0, sumS = 0, sumL = 0, weight = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 100) continue; // transparent pixel
      const { h, s, l } = rgbToHsl(r, g, b);
      if (s < 18 || l < 12 || l > 92) continue; // skip greys / near black / near white
      const w = s / 100;
      sumSin += Math.sin((h * Math.PI) / 180) * w;
      sumCos += Math.cos((h * Math.PI) / 180) * w;
      sumS += s * w;
      sumL += l * w;
      weight += w;
    }

    if (weight < 1) return null; // logo is effectively monochrome

    let h = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
    if (h < 0) h += 360;
    const s = sumS / weight;
    const l = sumL / weight;
    return { h, s, l };
  }

  function buildThemeFromHsl({ h, s }) {
    const accentS = Math.min(Math.max(s, 45), 72);
    const accent = `hsl(${h.toFixed(0)} ${accentS.toFixed(0)}% 40%)`;
    const accentSoft = `hsl(${h.toFixed(0)} ${Math.min(accentS, 55).toFixed(0)}% 92%)`;
    const bg = `hsl(${h.toFixed(0)} 28% 97%)`;
    const bgSoft = `hsl(${h.toFixed(0)} 30% 93%)`;
    const border = `hsl(${h.toFixed(0)} 24% 87%)`;
    const contrast = relativeLuminance(h, accentS, 40) > 0.55 ? "#2b2520" : "#ffffff";
    return {
      "--bg": bg,
      "--bg-soft": bgSoft,
      "--border": border,
      "--accent": accent,
      "--accent-soft": accentSoft,
      "--accent-contrast": contrast
    };
  }

  function applyVars(vars) {
    const root = document.documentElement.style;
    Object.entries(vars).forEach(([k, v]) => root.setProperty(k, v));
  }

  function resetToDefault() {
    applyVars(DEFAULT_VARS);
  }

  function storageKey(restaurantId) { return `infinitum_theme_${restaurantId}`; }

  function saveForRestaurant(restaurantId, vars) {
    if (!restaurantId) return;
    localStorage.setItem(storageKey(restaurantId), JSON.stringify(vars));
  }

  function loadForRestaurant(restaurantId) {
    if (!restaurantId) { resetToDefault(); return null; }
    const raw = localStorage.getItem(storageKey(restaurantId));
    if (raw) {
      try {
        const vars = JSON.parse(raw);
        applyVars(vars);
        return vars;
      } catch (e) { /* ignore and fall back below */ }
    }
    resetToDefault();
    return null;
  }

  /**
   * Main entry point: pass an <img> already loaded in the DOM (or about to
   * be), a restaurant id to persist the theme against, and a callback that
   * receives the derived theme vars (or null if the logo was monochrome).
   */
  function applyFromImage(img, restaurantId, onDone) {
    const run = () => {
      const hsl = samplePalette(img);
      let vars;
      if (hsl) {
        vars = buildThemeFromHsl(hsl);
      } else {
        vars = { ...DEFAULT_VARS };
      }
      applyVars(vars);
      saveForRestaurant(restaurantId, vars);
      if (onDone) onDone(vars, hsl);
    };
    if (img.complete) run();
    else img.onload = run;
  }

  /**
   * Loads the restaurant's saved theme if one exists; otherwise, if a logo
   * path is supplied (e.g. from seed data a restaurant already had before
   * ever visiting the dashboard), derives and saves a theme from it so the
   * page still reflects the logo on first visit.
   */
  function ensureTheme(restaurantId, logoSrc, onDone) {
    const existing = loadForRestaurant(restaurantId);
    if (existing) { if (onDone) onDone(existing); return; }
    if (!logoSrc) { if (onDone) onDone(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = logoSrc;
    applyFromImage(img, restaurantId, onDone);
  }

  return { applyFromImage, loadForRestaurant, ensureTheme, resetToDefault, DEFAULT_VARS };
})();

window.Theme = Theme;
