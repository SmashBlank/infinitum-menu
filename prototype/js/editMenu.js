/* ==========================================================================
   Infinitum — menu editor (e_mode)
   Shared by both admin and restaurant logins; the only difference is the
   `role` query param, which controls whether delete controls are shown.
   Category = parent (shown as a reorderable strip + section headers).
   Item = child (name, price/sizes, image, description) rendered as a tile.
   ========================================================================== */

(function () {
  const params = new URLSearchParams(window.location.search);
  const restaurantId = params.get("r") || "green-leaf-cafe";
  const role = params.get("role") === "admin" ? "admin" : "restaurant";
  const canDelete = role === "admin";

  let restaurant = DataStore.getRestaurant(restaurantId);
  if (!restaurant) {
    document.querySelector("main").innerHTML = "<p>Unknown restaurant.</p>";
    return;
  }

  // Track which single item tile is currently open for editing.
  let editingItemId = null;
  let openMoveMenuId = null;

  document.getElementById("brand-name").textContent = restaurant.name;
  document.getElementById("editor-title").textContent = `${restaurant.name} — menu editor`;
  document.getElementById("preview-link").href = `menu-view.html?r=${restaurantId}`;
  document.getElementById("back-link").href =
    role === "admin" ? "admin-dashboard.html" : `restaurant-dashboard.html?r=${restaurantId}`;
  Theme.ensureTheme(restaurantId, restaurant.logo);
  const rolePill = document.getElementById("role-pill");
  rolePill.textContent = role === "admin" ? "Admin — full access" : "Restaurant owner";
  if (role === "admin") rolePill.classList.add("is-admin");

  function persist() {
    DataStore.saveRestaurant(restaurantId, restaurant);
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function findCategory(catId) {
    return restaurant.categories.find((c) => c.id === catId);
  }

  // ---------------------------------------------------------------- render

  function render() {
    renderCategoryStrip();
    renderCategorySections();
  }

  function renderCategoryStrip() {
    const strip = document.getElementById("category-strip");
    strip.innerHTML = "";

    restaurant.categories.forEach((cat, idx) => {
      const chip = document.createElement("div");
      chip.className = "category-chip";
      chip.innerHTML = `
        ${idx > 0 ? `<button class="move-left" title="Move left">&#8592;</button>` : `<span style="width:22px;display:inline-block;"></span>`}
        <span class="cat-link">${cat.name}</span>
        ${idx < restaurant.categories.length - 1 ? `<button class="move-right" title="Move right">&#8594;</button>` : `<span style="width:22px;display:inline-block;"></span>`}
        ${canDelete ? `<button class="delete-cat" title="Delete category">&#10005;</button>` : ""}
      `;
      chip.querySelector(".cat-link").addEventListener("click", () => {
        document.getElementById(`section-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      chip.querySelector(".move-left")?.addEventListener("click", () => {
        [restaurant.categories[idx - 1], restaurant.categories[idx]] = [restaurant.categories[idx], restaurant.categories[idx - 1]];
        persist(); render();
      });
      chip.querySelector(".move-right")?.addEventListener("click", () => {
        [restaurant.categories[idx + 1], restaurant.categories[idx]] = [restaurant.categories[idx], restaurant.categories[idx + 1]];
        persist(); render();
      });
      chip.querySelector(".delete-cat")?.addEventListener("click", () => {
        if (!confirm(`Delete category "${cat.name}" and all its items?`)) return;
        restaurant.categories.splice(idx, 1);
        persist(); render();
      });
      strip.appendChild(chip);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-ghost btn-sm add-category-btn";
    addBtn.textContent = "+ Add category";
    addBtn.addEventListener("click", () => {
      const name = prompt("New category name:");
      if (!name || !name.trim()) return;
      restaurant.categories.push({ id: makeId("cat"), name: name.trim(), items: [] });
      persist(); render();
    });
    strip.appendChild(addBtn);
  }

  function renderCategorySections() {
    const container = document.getElementById("categories-container");
    container.innerHTML = "";

    restaurant.categories.forEach((cat) => {
      const section = document.createElement("section");
      section.className = "category-section";
      section.id = `section-${cat.id}`;

      const head = document.createElement("div");
      head.className = "category-section-head";
      head.innerHTML = `<h2>${cat.name}</h2><span class="size-legend">${cat.items.length} item${cat.items.length === 1 ? "" : "s"}</span>`;
      section.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "tile-grid";

      cat.items.forEach((item, idx) => {
        grid.appendChild(renderTile(cat, item, idx));
      });

      const addTile = document.createElement("button");
      addTile.className = "add-item-tile";
      addTile.innerHTML = "&#43; Add item";
      addTile.addEventListener("click", () => {
        const newItem = { id: makeId("item"), name: "New item", price: "0", image: null, description: "" };
        cat.items.push(newItem);
        editingItemId = newItem.id;
        persist(); render();
      });
      grid.appendChild(addTile);

      section.appendChild(grid);
      container.appendChild(section);
    });

    // Re-focus the name field if a tile was just opened for editing.
    if (editingItemId) {
      const input = document.querySelector(`[data-edit-name="${editingItemId}"]`);
      if (input) { input.focus(); input.select(); }
    }
  }

  function renderTile(cat, item, idx) {
    const tile = document.createElement("div");
    tile.className = "card tile" + (editingItemId === item.id ? " is-editing" : "");

    const isEditing = editingItemId === item.id;
    const hasSizes = !!item.sizes;
    const resolvedImage = DataStore.resolvedImage(item);
    const resolvedDesc = DataStore.resolvedDescription(item);

    // Left reorder arrows
    const leftControls = document.createElement("div");
    leftControls.className = "tile-controls-left";
    leftControls.innerHTML = `
      <button class="move-up" title="Move up" ${idx === 0 ? "disabled style='opacity:.3;cursor:default;'" : ""}>&#8593;</button>
      <button class="move-down" title="Move down" ${idx === cat.items.length - 1 ? "disabled style='opacity:.3;cursor:default;'" : ""}>&#8595;</button>
    `;
    leftControls.querySelector(".move-up").addEventListener("click", () => {
      if (idx === 0) return;
      [cat.items[idx - 1], cat.items[idx]] = [cat.items[idx], cat.items[idx - 1]];
      persist(); render();
    });
    leftControls.querySelector(".move-down").addEventListener("click", () => {
      if (idx === cat.items.length - 1) return;
      [cat.items[idx + 1], cat.items[idx]] = [cat.items[idx], cat.items[idx + 1]];
      persist(); render();
    });
    tile.appendChild(leftControls);

    // Right controls: edit pencil, delete (admin only, above pencil), move-category menu
    const rightControls = document.createElement("div");
    rightControls.className = "tile-controls-right";
    rightControls.innerHTML = `
      ${canDelete ? `<button class="btn-icon btn-danger-icon remove-item" title="Delete item">&#10005;</button>` : ""}
      <button class="btn-icon edit-item" title="${isEditing ? "Save" : "Edit"}">${isEditing ? "&#10003;" : "&#9998;"}</button>
      <div class="move-menu">
        <button class="btn-icon move-toggle" title="More">&#8942;</button>
        <div class="move-menu-list ${openMoveMenuId === item.id ? "open" : ""}">
          ${restaurant.categories.filter((c) => c.id !== cat.id).map((c) => `<button data-target-cat="${c.id}">Move to ${c.name}</button>`).join("")}
        </div>
      </div>
    `;
    rightControls.querySelector(".remove-item")?.addEventListener("click", () => {
      if (!confirm(`Delete "${item.name}"?`)) return;
      cat.items.splice(idx, 1);
      persist(); render();
    });
    rightControls.querySelector(".edit-item").addEventListener("click", () => {
      if (isEditing) {
        saveTileEdits(tile, cat, item);
        editingItemId = null;
      } else {
        editingItemId = item.id;
      }
      persist(); render();
    });
    rightControls.querySelector(".move-toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      openMoveMenuId = openMoveMenuId === item.id ? null : item.id;
      render();
    });
    rightControls.querySelectorAll("[data-target-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetCat = findCategory(btn.dataset.targetCat);
        cat.items.splice(idx, 1);
        targetCat.items.push(item);
        openMoveMenuId = null;
        persist(); render();
      });
    });
    tile.appendChild(rightControls);

    // View mode
    const view = document.createElement("div");
    view.className = "tile-view";
    view.innerHTML = `
      <div class="tile-img-wrap">
        <img src="${resolvedImage}" alt="${item.name}">
      </div>
      <div class="tile-name">${item.name}</div>
      <div class="tile-price">${DataStore.formatPrice(item)}</div>
      <p class="tile-desc">${resolvedDesc}</p>
    `;
    tile.appendChild(view);

    // Edit mode fields
    const editFields = document.createElement("div");
    editFields.className = "tile-edit-fields";
    editFields.innerHTML = `
      <div class="tile-img-wrap mt-8" style="margin-bottom:10px;">
        <img src="${resolvedImage}" alt="">
        <div class="tile-img-edit">&#128247; Change photo</div>
      </div>
      <div class="field">
        <label>Item name</label>
        <input type="text" data-edit-name="${item.id}" value="${item.name}">
      </div>
      <div class="field">
        <label><input type="checkbox" class="sizes-toggle" ${hasSizes ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;">Has sizes (S / M / L)</label>
      </div>
      <div class="field simple-price-field" style="${hasSizes ? "display:none;" : ""}">
        <label>Price (₹)</label>
        <input type="number" class="edit-price" value="${item.price || ""}">
      </div>
      <div class="field size-price-field" style="${hasSizes ? "" : "display:none;"}">
        <div class="size-input-row">
          <div><label>S (₹)</label><input type="number" class="edit-size-s" value="${item.sizes ? item.sizes.S : ""}"></div>
          <div><label>M (₹)</label><input type="number" class="edit-size-m" value="${item.sizes ? item.sizes.M : ""}"></div>
          <div><label>L (₹)</label><input type="number" class="edit-size-l" value="${item.sizes ? item.sizes.L : ""}"></div>
        </div>
      </div>
      <div class="field">
        <label>Description</label>
        <textarea class="edit-desc" placeholder="${DataStore.resolvedDescription(item)}">${item.description || ""}</textarea>
      </div>
    `;
    editFields.querySelector(".sizes-toggle").addEventListener("change", (e) => {
      editFields.querySelector(".simple-price-field").style.display = e.target.checked ? "none" : "";
      editFields.querySelector(".size-price-field").style.display = e.target.checked ? "" : "none";
    });
    editFields.querySelector(".tile-img-edit").addEventListener("click", () => {
      const input = document.getElementById("hidden-image-input");
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          item.image = ev.target.result;
          persist(); render();
        };
        reader.readAsDataURL(file);
        input.value = "";
      };
      input.click();
    });
    tile.appendChild(editFields);

    return tile;
  }

  function saveTileEdits(tile, cat, item) {
    const name = tile.querySelector(`[data-edit-name="${item.id}"]`).value.trim();
    if (name) item.name = name;
    const hasSizes = tile.querySelector(".sizes-toggle").checked;
    if (hasSizes) {
      item.sizes = {
        S: tile.querySelector(".edit-size-s").value || "0",
        M: tile.querySelector(".edit-size-m").value || "0",
        L: tile.querySelector(".edit-size-l").value || "0"
      };
      delete item.price;
    } else {
      item.price = tile.querySelector(".edit-price").value || "0";
      delete item.sizes;
    }
    item.description = tile.querySelector(".edit-desc").value.trim();
  }

  // Close any open "move to category" menu when clicking elsewhere.
  document.addEventListener("click", (e) => {
    if (openMoveMenuId && !e.target.closest(".move-menu")) {
      openMoveMenuId = null;
      render();
    }
  });

  render();
})();
