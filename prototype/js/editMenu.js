/* ==========================================================================
   Infinitum — menu editor (e_mode)
   Shared by both admin and restaurant logins; the only difference is the
   `role` query param, which controls whether delete controls are shown.
   Category = parent (shown as a reorderable strip + section headers).
   Item = child (name, price/sizes, image, description) rendered as a tile.
   All data now lives in Supabase — every mutation below calls DataStore,
   then reloads the draft menu from the database and re-renders, so the UI
   always reflects what's actually saved.
   ========================================================================== */

(function () {
  const params = new URLSearchParams(window.location.search);
  const restaurantId = params.get("r");
  const role = params.get("role") === "admin" ? "admin" : "restaurant";
  const canDelete = role === "admin";

  let restaurant = null;
  let categories = [];

  // Track which single item tile is currently open for editing.
  let editingItemId = null;
  let openMoveMenuId = null;
  let addDishMenuOpen = false;

  function makeTempId() {
    return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function findCategory(catId) {
    return categories.find((c) => c.id === catId);
  }

  async function reload() {
    categories = await DataStore.getDraftMenu(restaurantId);
    render();
    await refreshPublishStatus();
  }

  // Creates a new blank dish in the given category, opens it for editing,
  // and scrolls to it. Used by both the per-category "+ Add new dish" tile
  // and the toolbar-level "+ Add new dish" button — available to both the
  // admin and restaurant roles (only deleting is admin-only).
  async function addDishToCategory(cat) {
    addDishMenuOpen = false;
    const sortOrder = cat.items.length;
    const newItem = await DataStore.addItem(cat.id, { name: "New item", price: "0", image: null, description: "" }, sortOrder);
    editingItemId = newItem.id;
    await reload();
    document.getElementById(`section-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------------------------------------------------------------- render

  function render() {
    renderCategoryStrip();
    renderCategorySections();
    renderAddDishMenu();
  }

  function renderAddDishMenu() {
    const list = document.getElementById("add-dish-list");
    list.classList.toggle("open", addDishMenuOpen);
    if (!addDishMenuOpen) return;

    list.innerHTML =
      categories.map((c) => `<button data-add-cat="${c.id}">Add to "${c.name}"</button>`).join("") +
      `<button data-add-new-cat="1">+ New category…</button>`;

    list.querySelectorAll("[data-add-cat]").forEach((btn) => {
      btn.addEventListener("click", () => addDishToCategory(findCategory(btn.dataset.addCat)));
    });
    list.querySelector("[data-add-new-cat]").addEventListener("click", async () => {
      const name = prompt("New category name:");
      addDishMenuOpen = false;
      if (!name || !name.trim()) { render(); return; }
      const newCat = await DataStore.addCategory(restaurantId, name.trim(), categories.length);
      categories.push({ id: newCat.id, name: newCat.name, items: [] });
      await addDishToCategory(findCategory(newCat.id));
    });
  }

  function renderCategoryStrip() {
    const strip = document.getElementById("category-strip");
    strip.innerHTML = "";

    categories.forEach((cat, idx) => {
      const chip = document.createElement("div");
      chip.className = "category-chip";
      chip.innerHTML = `
        ${idx > 0 ? `<button class="move-left" title="Move left">&#8592;</button>` : `<span style="width:22px;display:inline-block;"></span>`}
        <span class="cat-link">${cat.name}</span>
        ${idx < categories.length - 1 ? `<button class="move-right" title="Move right">&#8594;</button>` : `<span style="width:22px;display:inline-block;"></span>`}
        ${canDelete ? `<button class="delete-cat" title="Delete category">&#10005;</button>` : ""}
      `;
      chip.querySelector(".cat-link").addEventListener("click", () => {
        document.getElementById(`section-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      chip.querySelector(".move-left")?.addEventListener("click", async () => {
        [categories[idx - 1], categories[idx]] = [categories[idx], categories[idx - 1]];
        await DataStore.reorderCategories(categories.map((c) => c.id));
        await reload();
      });
      chip.querySelector(".move-right")?.addEventListener("click", async () => {
        [categories[idx + 1], categories[idx]] = [categories[idx], categories[idx + 1]];
        await DataStore.reorderCategories(categories.map((c) => c.id));
        await reload();
      });
      chip.querySelector(".delete-cat")?.addEventListener("click", async () => {
        if (!confirm(`Delete category "${cat.name}" and all its items?`)) return;
        await DataStore.deleteCategory(cat.id);
        await reload();
      });
      strip.appendChild(chip);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-ghost btn-sm add-category-btn";
    addBtn.textContent = "+ Add category";
    addBtn.addEventListener("click", async () => {
      const name = prompt("New category name:");
      if (!name || !name.trim()) return;
      await DataStore.addCategory(restaurantId, name.trim(), categories.length);
      await reload();
    });
    strip.appendChild(addBtn);
  }

  function renderCategorySections() {
    const container = document.getElementById("categories-container");
    container.innerHTML = "";

    categories.forEach((cat) => {
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
      addTile.innerHTML = "&#43; Add new dish";
      addTile.addEventListener("click", () => addDishToCategory(cat));
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
    leftControls.querySelector(".move-up").addEventListener("click", async () => {
      if (idx === 0) return;
      [cat.items[idx - 1], cat.items[idx]] = [cat.items[idx], cat.items[idx - 1]];
      await DataStore.reorderItems(cat.items.map((it) => it.id));
      await reload();
    });
    leftControls.querySelector(".move-down").addEventListener("click", async () => {
      if (idx === cat.items.length - 1) return;
      [cat.items[idx + 1], cat.items[idx]] = [cat.items[idx], cat.items[idx + 1]];
      await DataStore.reorderItems(cat.items.map((it) => it.id));
      await reload();
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
          ${categories.filter((c) => c.id !== cat.id).map((c) => `<button data-target-cat="${c.id}">Move to ${c.name}</button>`).join("")}
        </div>
      </div>
    `;
    rightControls.querySelector(".remove-item")?.addEventListener("click", async () => {
      if (!confirm(`Delete "${item.name}"?`)) return;
      await DataStore.deleteItem(item.id);
      await reload();
    });
    rightControls.querySelector(".edit-item").addEventListener("click", async () => {
      if (isEditing) {
        await saveTileEdits(tile, item);
        editingItemId = null;
        await reload();
      } else {
        editingItemId = item.id;
        render();
      }
    });
    rightControls.querySelector(".move-toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      openMoveMenuId = openMoveMenuId === item.id ? null : item.id;
      render();
    });
    rightControls.querySelectorAll("[data-target-cat]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const targetCat = findCategory(btn.dataset.targetCat);
        openMoveMenuId = null;
        await DataStore.moveItemToCategory(item.id, targetCat.id, targetCat.items.length);
        await reload();
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
      input.onchange = async () => {
        const file = input.files[0];
        input.value = "";
        if (!file) return;
        const imgWrap = editFields.querySelector(".tile-img-wrap img");
        imgWrap.style.opacity = "0.4";
        try {
          const url = await DataStore.uploadImage("dish-images", file, restaurantId);
          await DataStore.updateItem(item.id, { image: url });
          await reload();
        } catch (err) {
          alert("Couldn't upload that image — please try a different file.");
          imgWrap.style.opacity = "1";
        }
      };
      input.click();
    });
    tile.appendChild(editFields);

    return tile;
  }

  async function saveTileEdits(tile, item) {
    const fields = {};
    const name = tile.querySelector(`[data-edit-name="${item.id}"]`).value.trim();
    if (name) fields.name = name;
    const hasSizes = tile.querySelector(".sizes-toggle").checked;
    if (hasSizes) {
      fields.sizes = {
        S: tile.querySelector(".edit-size-s").value || "0",
        M: tile.querySelector(".edit-size-m").value || "0",
        L: tile.querySelector(".edit-size-l").value || "0"
      };
      fields.price = null;
    } else {
      fields.price = tile.querySelector(".edit-price").value || "0";
      fields.sizes = null;
    }
    fields.description = tile.querySelector(".edit-desc").value.trim();
    await DataStore.updateItem(item.id, fields);
  }

  // ---------------------------------------------------------------- publish

  async function refreshPublishStatus() {
    const publishBtn = document.getElementById("publish-btn");
    const publishPill = document.getElementById("publish-status-pill");
    if (categories.length === 0) {
      publishPill.textContent = "Nothing to publish yet";
      publishPill.classList.remove("is-admin");
      publishBtn.disabled = true;
      publishBtn.textContent = "Publish";
      return;
    }
    const unpublished = !menusAreEqual(categories, restaurant.published_menu);
    if (unpublished) {
      publishPill.textContent = "Draft changes";
      publishPill.classList.add("is-admin");
      publishBtn.disabled = false;
      publishBtn.textContent = "Publish changes";
    } else {
      publishPill.textContent = "Live ✓";
      publishPill.classList.remove("is-admin");
      publishBtn.disabled = true;
      publishBtn.textContent = "Published";
    }
  }

  // ---------------------------------------------------------------- init

  (async function init() {
    const profile = await Auth.requireProfile();
    if (!profile) return;
    if (profile.role === "restaurant" && profile.restaurant_id !== restaurantId) {
      window.location.href = `restaurant-dashboard.html?r=${profile.restaurant_id}`;
      return;
    }

    restaurant = await DataStore.getRestaurant(restaurantId);
    if (!restaurant) {
      document.querySelector("main").innerHTML = "<p>Unknown restaurant.</p>";
      return;
    }

    document.getElementById("brand-name").textContent = restaurant.name;
    document.getElementById("editor-title").textContent = `${restaurant.name} — menu editor`;
    document.getElementById("preview-link").href = `menu-view.html?r=${restaurantId}&preview=1`;
    document.getElementById("back-link").href =
      role === "admin" ? "admin-dashboard.html" : `restaurant-dashboard.html?r=${restaurantId}`;
    const rolePill = document.getElementById("role-pill");
    rolePill.textContent = role === "admin" ? "Admin — full access" : "Restaurant owner";
    if (role === "admin") rolePill.classList.add("is-admin");

    const themeCard = document.getElementById("theme-card");
    document.getElementById("theme-toggle-btn").addEventListener("click", () => {
      themeCard.classList.toggle("hidden");
    });
    const initialThemeState = restaurant.theme || Theme.defaultState();
    Theme.applyVars(initialThemeState.vars);
    mountThemePanel(document.getElementById("theme-panel"), restaurantId, restaurant, initialThemeState, {
      onChange: (state) => DataStore.updateRestaurantTheme(restaurantId, state)
    });

    document.getElementById("publish-btn").addEventListener("click", async () => {
      await DataStore.publish(restaurantId);
      restaurant.published_menu = categories;
      await refreshPublishStatus();
      alert("Your menu is now live — customers will see these changes.");
    });

    // Toolbar-level "+ Add new dish" button — lets you add a dish without
    // scrolling to find its category, and can create a brand-new category
    // on the fly if none exist yet.
    document.getElementById("add-dish-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (categories.length === 0) {
        const name = prompt("You'll need a category first. Name your first category:");
        if (!name || !name.trim()) return;
        const newCat = await DataStore.addCategory(restaurantId, name.trim(), 0);
        categories.push({ id: newCat.id, name: newCat.name, items: [] });
        await addDishToCategory(findCategory(newCat.id));
        return;
      }
      if (categories.length === 1) {
        await addDishToCategory(categories[0]);
        return;
      }
      addDishMenuOpen = !addDishMenuOpen;
      render();
    });

    // Close any open "move to category" or "add new dish" menu when clicking elsewhere.
    document.addEventListener("click", (e) => {
      if (openMoveMenuId && !e.target.closest(".move-menu")) {
        openMoveMenuId = null;
        render();
      }
      if (addDishMenuOpen && !e.target.closest("#add-dish-menu")) {
        addDishMenuOpen = false;
        render();
      }
    });

    await reload();
  })();
})();
