/* ==========================================================================
   Infinitum — data layer (Supabase-backed)
   Every method that reads or writes restaurant/category/item data talks to
   the real Postgres database via Supabase, instead of localStorage. Access
   control is enforced server-side by the Row Level Security policies in
   supabase/schema.sql — this file just calls the API and shapes the results
   for the UI code.
   ========================================================================== */

const DEFAULT_IMAGE = "assets/images/default-dish.svg";

// Feature (Default_Descr) + default photo: generic, ingredient-only
// descriptions and a representative icon, keyed by dish name. Used until a
// restaurant overrides them with their own (Edit_descr / Edit_Image). This
// is intentionally a simple name-match lookup — a dish whose name contains
// (or exactly matches) one of these keys gets that default automatically.
const DISH_DEFAULTS = {
  "poha": { description: "A light breakfast made with flattened rice.", image: "assets/images/dish-rice.svg" },
  "masala dosa": { description: "A crisp fermented rice-and-lentil crepe.", image: "assets/images/dish-south-indian.svg" },
  "idli": { description: "Steamed, fluffy rice-and-lentil cakes.", image: "assets/images/dish-south-indian.svg" },
  "butter naan": { description: "Oven-baked leavened bread brushed with butter.", image: "assets/images/dish-bread.svg" },
  "naan": { description: "Oven-baked leavened bread.", image: "assets/images/dish-bread.svg" },
  "paneer tikka": { description: "Marinated cottage cheese, chargrilled.", image: "assets/images/dish-curry-bowl.svg" },
  "margherita": { description: "A classic pizza topped with mozzarella and tomato.", image: "assets/images/dish-pizza.svg" },
  "pizza": { description: "A classic pizza, baked fresh.", image: "assets/images/dish-pizza.svg" },
  "pasta": { description: "Pasta tossed in a savory sauce.", image: "assets/images/dish-pasta.svg" },
  "sandwich": { description: "Toasted bread layered with fresh fillings.", image: "assets/images/dish-sandwich.svg" },
  "cold coffee": { description: "Chilled, blended coffee.", image: "assets/images/dish-cold-beverage.svg" },
  "cappuccino": { description: "Espresso topped with steamed milk foam.", image: "assets/images/dish-hot-beverage.svg" },
  "coffee": { description: "Freshly brewed coffee.", image: "assets/images/dish-hot-beverage.svg" },
  "tea": { description: "Freshly brewed tea.", image: "assets/images/dish-hot-beverage.svg" },
  "french fries": { description: "Crisp, golden fried potato strips.", image: "assets/images/dish-fried-snack.svg" },
  "fries": { description: "Crisp, golden fried potato strips.", image: "assets/images/dish-fried-snack.svg" },
  "caesar salad": { description: "Crisp lettuce tossed in a classic dressing.", image: "assets/images/dish-salad.svg" },
  "salad": { description: "A fresh, crisp salad.", image: "assets/images/dish-salad.svg" },
  "garlic bread": { description: "Toasted bread topped with garlic butter.", image: "assets/images/dish-bread.svg" },
  "chole bhature": { description: "Spiced chickpeas served with fried bread.", image: "assets/images/dish-curry-bowl.svg" },
  "pav bhaji": { description: "A spiced mashed-vegetable curry with soft buns.", image: "assets/images/dish-curry-bowl.svg" },
  "butter chicken": { description: "Chicken simmered in a creamy tomato gravy.", image: "assets/images/dish-curry-bowl.svg" },
  "veg manchurian": { description: "Fried vegetable dumplings in a tangy sauce.", image: "assets/images/dish-pasta.svg" },
  "hakka noodles": { description: "Stir-fried noodles with vegetables.", image: "assets/images/dish-pasta.svg" },
  "noodles": { description: "Stir-fried noodles.", image: "assets/images/dish-pasta.svg" },
  "default": { description: "A house favorite, made fresh to order.", image: DEFAULT_IMAGE }
};

function lookupDishDefault(name) {
  const key = (name || "").trim().toLowerCase();
  if (DISH_DEFAULTS[key]) return DISH_DEFAULTS[key];
  // Fall back to a partial match (e.g. "Margherita Pizza" still matches "margherita").
  const partial = Object.keys(DISH_DEFAULTS).find((k) => k !== "default" && key.includes(k));
  return partial ? DISH_DEFAULTS[partial] : DISH_DEFAULTS.default;
}

// Postgres JSONB columns don't preserve object-key insertion order, so a
// freshly-built draft (keys in a fixed JS order) can come back from
// `published_menu` with keys reordered even when the data is identical.
// Sorting keys recursively before stringifying makes the comparison
// actually reflect whether the content changed, not just key order.
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function menusAreEqual(a, b) {
  return stableStringify(a || []) === stableStringify(b || []);
}

const DataStore = {
  // ---------------------------------------------------------------- restaurants

  async listRestaurants() {
    const { data, error } = await sb.from("restaurants").select("*").order("created_at");
    if (error) throw error;
    return data;
  },

  async getRestaurant(id) {
    const { data, error } = await sb.from("restaurants").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  },

  async createRestaurant({ slug, name, plan }) {
    const { data, error } = await sb.from("restaurants")
      .insert({ slug, name, plan: plan || "Free plan" })
      .select().single();
    if (error) throw error;
    return data;
  },

  async updateRestaurantTheme(id, themeState) {
    const { error } = await sb.from("restaurants").update({ theme: themeState }).eq("id", id);
    if (error) throw error;
  },

  async updateRestaurantLogo(id, logoUrl) {
    const { error } = await sb.from("restaurants").update({ logo_url: logoUrl }).eq("id", id);
    if (error) throw error;
  },

  // ---------------------------------------------------------------- categories + items (draft)

  /** Returns the restaurant's draft menu as [{ id, name, items: [...] }], sorted. */
  async getDraftMenu(restaurantId) {
    const { data: categories, error: catErr } = await sb.from("categories")
      .select("*").eq("restaurant_id", restaurantId).order("sort_order");
    if (catErr) throw catErr;
    if (categories.length === 0) return [];

    const { data: items, error: itemErr } = await sb.from("items")
      .select("*").in("category_id", categories.map((c) => c.id)).order("sort_order");
    if (itemErr) throw itemErr;

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      items: items.filter((it) => it.category_id === cat.id).map((it) => ({
        id: it.id,
        name: it.name,
        price: it.price,
        sizes: it.sizes,
        image: it.image_url,
        description: it.description
      }))
    }));
  },

  async addCategory(restaurantId, name, sortOrder) {
    const { data, error } = await sb.from("categories")
      .insert({ restaurant_id: restaurantId, name, sort_order: sortOrder })
      .select().single();
    if (error) throw error;
    return data;
  },

  async renameCategory(categoryId, name) {
    const { error } = await sb.from("categories").update({ name }).eq("id", categoryId);
    if (error) throw error;
  },

  async deleteCategory(categoryId) {
    const { error } = await sb.from("categories").delete().eq("id", categoryId);
    if (error) throw error;
  },

  async reorderCategories(orderedIds) {
    await Promise.all(orderedIds.map((id, idx) =>
      sb.from("categories").update({ sort_order: idx }).eq("id", id)
    ));
  },

  async addItem(categoryId, fields, sortOrder) {
    const { data, error } = await sb.from("items").insert({
      category_id: categoryId,
      name: fields.name,
      price: fields.price ?? null,
      sizes: fields.sizes ?? null,
      image_url: fields.image ?? null,
      description: fields.description ?? null,
      sort_order: sortOrder
    }).select().single();
    if (error) throw error;
    return data;
  },

  async updateItem(itemId, fields) {
    const payload = {};
    if ("name" in fields) payload.name = fields.name;
    if ("price" in fields) payload.price = fields.price;
    if ("sizes" in fields) payload.sizes = fields.sizes;
    if ("image" in fields) payload.image_url = fields.image;
    if ("description" in fields) payload.description = fields.description;
    const { error } = await sb.from("items").update(payload).eq("id", itemId);
    if (error) throw error;
  },

  async deleteItem(itemId) {
    const { error } = await sb.from("items").delete().eq("id", itemId);
    if (error) throw error;
  },

  async moveItemToCategory(itemId, newCategoryId, sortOrder) {
    const { error } = await sb.from("items")
      .update({ category_id: newCategoryId, sort_order: sortOrder }).eq("id", itemId);
    if (error) throw error;
  },

  async reorderItems(orderedIds) {
    await Promise.all(orderedIds.map((id, idx) =>
      sb.from("items").update({ sort_order: idx }).eq("id", id)
    ));
  },

  // ---------------------------------------------------------------- publish

  async publish(restaurantId) {
    const draft = await this.getDraftMenu(restaurantId);
    const { error } = await sb.from("restaurants")
      .update({ published_menu: draft }).eq("id", restaurantId);
    if (error) throw error;
    return draft;
  },

  async hasUnpublishedChanges(restaurant) {
    const draft = await this.getDraftMenu(restaurant.id);
    return !menusAreEqual(draft, restaurant.published_menu);
  },

  // ---------------------------------------------------------------- storage uploads

  async uploadImage(bucket, file, restaurantId) {
    const ext = file.name.split(".").pop();
    const path = `${restaurantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  // ---------------------------------------------------------------- scanning helper

  /** Merges freshly-scanned categories/items into a restaurant's draft menu,
   *  matching by category name (case-insensitive) instead of overwriting. */
  async mergeScannedCategories(restaurantId, scannedCategories) {
    const existing = await this.getDraftMenu(restaurantId);
    for (const scanned of scannedCategories) {
      const match = existing.find((c) => c.name.trim().toLowerCase() === scanned.name.trim().toLowerCase());
      const category = match ? { id: match.id } : await this.addCategory(restaurantId, scanned.name, existing.length);
      let sortOrder = match ? match.items.length : 0;
      for (const item of scanned.items) {
        await this.addItem(category.id, item, sortOrder++);
      }
    }
  },

  // ---------------------------------------------------------------- display helpers (pure, no DB)

  resolvedDescription(item) {
    return item.description && item.description.trim()
      ? item.description
      : lookupDishDefault(item.name).description;
  },

  resolvedImage(item) {
    return item.image || lookupDishDefault(item.name).image;
  },

  formatPrice(item) {
    if (item.sizes) {
      return `S ₹${item.sizes.S} · M ₹${item.sizes.M} · L ₹${item.sizes.L}`;
    }
    return `₹${item.price}`;
  }
};

window.DataStore = DataStore;
window.DEFAULT_IMAGE = DEFAULT_IMAGE;
window.menusAreEqual = menusAreEqual;
