/* ==========================================================================
   Infinitum — mock data layer
   Stands in for the real database. Seeds three demo restaurants and a table
   of generic dish descriptions. Everything is persisted to localStorage so
   edits made in the editor survive a refresh, the same way they would once
   this is backed by a real database.
   ========================================================================== */

const DEFAULT_IMAGE = "assets/images/default-dish.svg";

// Feature (Default_Descr): generic, ingredient-only descriptions used until
// a restaurant overrides them with their own (Edit_descr).
const DEFAULT_DESCRIPTIONS = {
  "poha": "A light breakfast made with flattened rice.",
  "masala dosa": "A crisp fermented rice-and-lentil crepe.",
  "idli": "Steamed, fluffy rice-and-lentil cakes.",
  "butter naan": "Oven-baked leavened bread brushed with butter.",
  "paneer tikka": "Marinated cottage cheese, chargrilled.",
  "margherita pizza": "A classic pizza topped with mozzarella and tomato.",
  "pasta alfredo": "Pasta tossed in a creamy cheese sauce.",
  "veg sandwich": "Toasted bread layered with fresh vegetables.",
  "cold coffee": "Chilled, blended coffee.",
  "cappuccino": "Espresso topped with steamed milk foam.",
  "french fries": "Crisp, golden fried potato strips.",
  "caesar salad": "Crisp lettuce tossed in a classic dressing.",
  "garlic bread": "Toasted bread topped with garlic butter.",
  "chole bhature": "Spiced chickpeas served with fried bread.",
  "pav bhaji": "A spiced mashed-vegetable curry with soft buns.",
  "butter chicken": "Chicken simmered in a creamy tomato gravy.",
  "veg manchurian": "Fried vegetable dumplings in a tangy sauce.",
  "margherita": "A classic pizza topped with mozzarella and tomato.",
  "hakka noodles": "Stir-fried noodles with vegetables.",
  "default": "A house favorite, made fresh to order."
};

function lookupDefaultDescription(name) {
  const key = (name || "").trim().toLowerCase();
  return DEFAULT_DESCRIPTIONS[key] || DEFAULT_DESCRIPTIONS.default;
}

// Seed data — acts as "what's already in the database" for the demo.
const SEED_RESTAURANTS = {
  "green-leaf-cafe": {
    id: "green-leaf-cafe",
    name: "Green Leaf Cafe",
    plan: "Free plan",
    logo: "assets/logos/green-leaf-cafe.svg",
    categories: [
      {
        id: "cat-breakfast",
        name: "Breakfast",
        items: [
          { id: "i1", name: "Poha", price: "60", image: null, description: null },
          { id: "i2", name: "Masala Dosa", price: "90", image: null, description: null },
          { id: "i3", name: "Idli (4 pcs)", price: "70", image: null, description: "Soft steamed idlis served with chutney and sambar." }
        ]
      },
      {
        id: "cat-beverages",
        name: "Beverages",
        items: [
          { id: "i4", name: "Cold Coffee", price: "120", image: null, description: null },
          { id: "i5", name: "Cappuccino", price: "110", image: null, description: null }
        ]
      },
      {
        id: "cat-sandwiches",
        name: "Sandwiches",
        items: [
          { id: "i6", name: "Veg Sandwich", price: "100", image: null, description: null }
        ]
      }
    ]
  },
  "spice-route": {
    id: "spice-route",
    name: "Spice Route",
    plan: "Pro plan",
    logo: "assets/logos/spice-route.svg",
    categories: [
      {
        id: "cat-starters",
        name: "Starters",
        items: [
          { id: "i7", name: "Paneer Tikka", price: "220", image: null, description: null },
          { id: "i8", name: "Veg Manchurian", price: "190", image: null, description: null }
        ]
      },
      {
        id: "cat-mains",
        name: "Main Course",
        items: [
          { id: "i9", name: "Butter Chicken", price: "320", image: null, description: null },
          { id: "i10", name: "Chole Bhature", price: "150", image: null, description: null }
        ]
      },
      {
        id: "cat-breads",
        name: "Breads",
        items: [
          { id: "i11", name: "Butter Naan", price: "45", image: null, description: null }
        ]
      }
    ]
  },
  "blue-wave-pizza": {
    id: "blue-wave-pizza",
    name: "Blue Wave Pizzeria",
    plan: "Pro plan",
    logo: "assets/logos/blue-wave-pizza.svg",
    categories: [
      {
        id: "cat-pizza",
        name: "Pizza",
        items: [
          {
            id: "i12", name: "Margherita", image: null, description: null,
            sizes: { S: "199", M: "349", L: "499" }
          },
          {
            id: "i13", name: "Farmhouse", image: null, description: "A veggie-loaded pizza with garden-fresh toppings.",
            sizes: { S: "249", M: "399", L: "549" }
          }
        ]
      },
      {
        id: "cat-pasta",
        name: "Pasta",
        items: [
          { id: "i14", name: "Pasta Alfredo", price: "230", image: null, description: null }
        ]
      },
      {
        id: "cat-drinks",
        name: "Drinks",
        items: [
          { id: "i15", name: "French Fries", price: "130", image: null, description: null }
        ]
      }
    ]
  }
};

const DataStore = {
  _storageKey(id) { return `infinitum_menu_${id}`; },

  listRestaurants() {
    return Object.keys(SEED_RESTAURANTS).map((id) => this.getRestaurant(id));
  },

  getRestaurant(id) {
    const raw = localStorage.getItem(this._storageKey(id));
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through to seed */ }
    }
    const seed = SEED_RESTAURANTS[id];
    if (!seed) return null;
    const clone = JSON.parse(JSON.stringify(seed));
    this.saveRestaurant(id, clone);
    return clone;
  },

  saveRestaurant(id, data) {
    localStorage.setItem(this._storageKey(id), JSON.stringify(data));
  },

  resetRestaurant(id) {
    localStorage.removeItem(this._storageKey(id));
    return this.getRestaurant(id);
  },

  resolvedDescription(item) {
    return item.description && item.description.trim()
      ? item.description
      : lookupDefaultDescription(item.name);
  },

  resolvedImage(item) {
    return item.image || DEFAULT_IMAGE;
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
