/* ==========================================================================
   Infinitum — logo color theme feature (logo_upl / colorscheme_upl)
   Three ways a restaurant (or admin, on their behalf) can set the page's
   "ambience": (1) upload a logo and let us pick a matching color, (2) pick
   any color from a color palette and have shades generated automatically,
   or (3) fine-tune by clicking one of several auto-generated shades of that
   same color. Everything is persisted per restaurant so it survives reloads
   and is reflected consistently across the dashboard, editor, and the
   public menu page.
   ========================================================================== */

const Theme = (() => {
  const DEFAULT_HEX = "#b05c3d"; // warm terracotta — base theme default

  const DEFAULT_VARS = {
    "--bg": "#faf6f0",
    "--bg-soft": "#f3ece2",
    "--border": "#e7ddcd",
    "--accent": "#b05c3d",
    "--accent-soft": "#f3e2d8",
    "--accent-contrast": "#ffffff"
  };

  // ---------------------------------------------------------------- color math

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = parseInt(full, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

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

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  function hslToHex(h, s, l) {
    const { r, g, b } = hslToRgb(h, s, l);
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function hexToHsl(hex) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsl(r, g, b);
  }

  // ---------------------------------------------------------------- theme building

  /** Builds the full readable theme (bg/border/accent/contrast) from a hue+saturation. */
  function buildThemeFromHsl({ h, s, l }) {
    const accentS = Math.min(Math.max(s, 45), 72);
    const accentL = Math.min(Math.max(l === undefined ? 40 : l, 28), 55);
    const accent = hslToHex(h, accentS, accentL);
    const accentSoft = hslToHex(h, Math.min(accentS, 55), 92);
    const bg = hslToHex(h, 28, 97);
    const bgSoft = hslToHex(h, 30, 93);
    const border = hslToHex(h, 24, 87);
    const contrast = accentL > 55 ? "#2b2520" : "#ffffff";
    return {
      "--bg": bg,
      "--bg-soft": bgSoft,
      "--border": border,
      "--accent": accent,
      "--accent-soft": accentSoft,
      "--accent-contrast": contrast
    };
  }

  /** A handful of shades of the same hue/saturation, light → dark, for manual picking. */
  function generateShades({ h, s }) {
    const accentS = Math.min(Math.max(s, 45), 72);
    return [28, 36, 44, 52, 60].map((l) => ({ l, hex: hslToHex(h, accentS, l) }));
  }

  // ---------------------------------------------------------------- sampling a logo

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

  // ---------------------------------------------------------------- apply + persist

  function applyVars(vars) {
    const root = document.documentElement.style;
    Object.entries(vars).forEach(([k, v]) => root.setProperty(k, v));
  }

  function storageKey(restaurantId) { return `infinitum_theme_${restaurantId}`; }

  /** Saves the full theme state (not just the CSS vars) so a later page load
   *  can tell *why* this theme was chosen, instead of re-deriving it from
   *  the logo every time nothing is explicitly saved. */
  function saveState(restaurantId, state) {
    if (!restaurantId) return;
    localStorage.setItem(storageKey(restaurantId), JSON.stringify(state));
  }

  function loadState(restaurantId) {
    if (!restaurantId) return null;
    const raw = localStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function applyAndSave(hsl, restaurantId, source, onDone) {
    const vars = buildThemeFromHsl(hsl);
    applyVars(vars);
    const state = { hsl, vars, source };
    saveState(restaurantId, state);
    if (onDone) onDone(vars, hsl);
    return state;
  }

  /** Resets to the default warm-neutral theme — and *saves* that choice
   *  explicitly, so re-visiting the page later doesn't silently re-derive
   *  a theme from the logo again. */
  function resetToDefault(restaurantId) {
    const hsl = hexToHsl(DEFAULT_HEX);
    applyVars(DEFAULT_VARS);
    saveState(restaurantId, { hsl, vars: DEFAULT_VARS, source: "default" });
    return { hsl, vars: DEFAULT_VARS };
  }

  /**
   * Main entry point for logo uploads: pass an <img> already loaded in the
   * DOM (or about to be), a restaurant id to persist the theme against, and
   * a callback that receives the derived theme vars (or default if the logo
   * was monochrome).
   */
  function applyFromImage(img, restaurantId, onDone) {
    const run = () => {
      const hsl = samplePalette(img) || hexToHsl(DEFAULT_HEX);
      applyAndSave(hsl, restaurantId, "logo", onDone);
    };
    if (img.complete) run();
    else img.onload = run;
  }

  /** Applies a color picked manually (e.g. from an <input type="color">). */
  function applyFromHex(hex, restaurantId, onDone) {
    const hsl = hexToHsl(hex);
    return applyAndSave(hsl, restaurantId, "manual", onDone);
  }

  /** Applies one specific shade (same hue/sat, different lightness) chosen
   *  by clicking a swatch in the shade palette. */
  function applyShade(baseHsl, lightness, restaurantId, onDone) {
    const hsl = { h: baseHsl.h, s: baseHsl.s, l: lightness };
    return applyAndSave(hsl, restaurantId, "manual", onDone);
  }

  /**
   * Loads the restaurant's saved theme state if one exists (this is the
   * source of truth once a restaurant has made *any* explicit choice,
   * including "reset to default"). Only if nothing has ever been saved does
   * it fall back to deriving a theme from a seed logo, so first-time seed
   * data still looks branded on first visit.
   */
  function ensureTheme(restaurantId, logoSrc, onDone) {
    const existing = loadState(restaurantId);
    if (existing) {
      applyVars(existing.vars);
      if (onDone) onDone(existing.vars, existing.hsl);
      return existing;
    }
    if (!logoSrc) {
      const state = resetToDefault(restaurantId);
      if (onDone) onDone(state.vars, state.hsl);
      return state;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = logoSrc;
    applyFromImage(img, restaurantId, onDone);
    return null;
  }

  return {
    applyFromImage, applyFromHex, applyShade,
    ensureTheme, loadState, resetToDefault,
    generateShades, hexToHsl, hslToHex,
    DEFAULT_VARS, DEFAULT_HEX
  };
})();

window.Theme = Theme;
