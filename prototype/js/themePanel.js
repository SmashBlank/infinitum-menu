/* ==========================================================================
   Infinitum — reusable "logo & color theme" panel
   Mounted on both the restaurant dashboard and the menu editor (so admins
   editing on a restaurant's behalf have the same controls). Offers three
   ways to set the theme: upload a logo, pick any color from a palette
   (shades generated automatically), or fine-tune by clicking a specific
   auto-generated shade of the chosen color.
   ========================================================================== */

function mountThemePanel(container, restaurantId, restaurant, initialState, options = {}) {
  const onChange = options.onChange || (() => {});

  container.innerHTML = `
    <div class="logo-upload-box">
      <div class="logo-preview" data-role="logo-preview"></div>
      <div>
        <label class="mb-0" style="font-size:0.78rem;">Upload a logo</label>
        <input type="file" accept="image/*" data-role="logo-input">
      </div>
    </div>

    <div class="field mt-16 mb-0">
      <label>Or pick any color</label>
      <div class="flex gap-12" style="align-items:center;">
        <input type="color" class="color-swatch-input" data-role="color-input">
        <span class="muted" style="font-size:0.8rem;">We'll generate matching shades for you automatically.</span>
      </div>
    </div>

    <div class="field mt-16 mb-0">
      <label>Fine-tune the shade (optional)</label>
      <div class="shade-row" data-role="shade-row"></div>
    </div>

    <div class="swatch-row mt-16" data-role="swatch-row"></div>
    <button class="btn btn-ghost btn-sm mt-16" data-role="reset-btn">Reset to default colors</button>
  `;

  const logoPreview = container.querySelector('[data-role="logo-preview"]');
  const logoInput = container.querySelector('[data-role="logo-input"]');
  const colorInput = container.querySelector('[data-role="color-input"]');
  const shadeRow = container.querySelector('[data-role="shade-row"]');
  const swatchRow = container.querySelector('[data-role="swatch-row"]');
  const resetBtn = container.querySelector('[data-role="reset-btn"]');

  let currentHsl = initialState.hsl;

  function renderLogoPreview() {
    logoPreview.innerHTML = restaurant.logo
      ? `<img src="${restaurant.logo}" alt="Logo">`
      : `<span class="muted" style="font-size:0.72rem;">No logo</span>`;
  }

  function renderSwatches(vars) {
    swatchRow.innerHTML = "";
    ["--accent", "--accent-soft", "--bg-soft"].forEach((key) => {
      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = vars[key];
      swatchRow.appendChild(sw);
    });
  }

  function renderShadeRow(hsl, syncColorInput = true) {
    currentHsl = hsl;
    if (syncColorInput) {
      const previewL = hsl.l !== undefined ? hsl.l : 40;
      colorInput.value = Theme.hslToHex(hsl.h, Math.min(Math.max(hsl.s, 45), 72), previewL);
    }
    const shades = Theme.generateShades(hsl);
    shadeRow.innerHTML = "";
    shades.forEach(({ l, hex }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shade-swatch" + (Math.abs(l - (hsl.l ?? 40)) < 5 ? " active" : "");
      btn.style.background = hex;
      btn.title = `Shade ${l}%`;
      btn.addEventListener("click", () => {
        const state = Theme.applyShade(currentHsl, l, restaurantId, (vars) => {
          renderSwatches(vars);
        });
        renderShadeRow({ ...currentHsl, l });
        onChange(state);
      });
      shadeRow.appendChild(btn);
    });
  }

  renderLogoPreview();
  renderSwatches(initialState.vars);
  renderShadeRow(currentHsl);

  logoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      restaurant.logo = dataUrl;
      renderLogoPreview();
      const img = new Image();
      img.src = dataUrl;
      Theme.applyFromImage(img, restaurantId, (vars, hsl) => {
        renderSwatches(vars);
        renderShadeRow(hsl);
        onChange({ vars, hsl, source: "logo" });
      });
    };
    reader.readAsDataURL(file);
  });

  colorInput.addEventListener("input", (e) => {
    const state = Theme.applyFromHex(e.target.value, restaurantId, (vars) => {
      renderSwatches(vars);
    });
    currentHsl = state.hsl;
    renderShadeRow(state.hsl, false);
    onChange(state);
  });

  resetBtn.addEventListener("click", () => {
    const state = Theme.resetToDefault(restaurantId);
    renderSwatches(state.vars);
    renderShadeRow(state.hsl);
    onChange(state);
  });
}

window.mountThemePanel = mountThemePanel;
