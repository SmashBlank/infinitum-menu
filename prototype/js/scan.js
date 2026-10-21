/* ==========================================================================
   Infinitum — "Scan new menu" camera flow
   Used by both Admin (onboarding a brand-new restaurant) and restaurant
   owners (scanning their own paper menu, e.g. right after signing up).
   Snaps multiple photos, lets you remove any before finishing, then
   simulates analyzing them into categories/items. Real OCR is a later
   phase — this wires up the full UX so it can be swapped in without a
   redesign. Scanned results are merged into the restaurant's *draft* menu
   only — customers won't see anything until it's Published in the editor.
   ========================================================================== */

(function () {
  const params = new URLSearchParams(window.location.search);
  const restaurantId = params.get("r"); // absent = admin onboarding a brand-new restaurant
  const role = params.get("role") === "admin" ? "admin" : "restaurant";
  const restaurant = restaurantId ? DataStore.getRestaurant(restaurantId) : null;

  const video = document.getElementById("camera-video");
  const placeholder = document.getElementById("camera-placeholder");
  const startBtn = document.getElementById("start-camera-btn");
  const shutterBtn = document.getElementById("shutter-btn");
  const doneBtn = document.getElementById("done-btn");
  const shotsStrip = document.getElementById("shots-strip");
  const fallbackInput = document.getElementById("fallback-file-input");
  const analyzingOverlay = document.getElementById("analyzing-overlay");
  const cameraStage = document.getElementById("camera-stage");

  if (restaurant) {
    document.getElementById("brand-name").textContent = restaurant.name;
    document.getElementById("brand-link").href = `restaurant-dashboard.html?r=${restaurantId}`;
    document.getElementById("cancel-link").href =
      role === "admin" ? `edit-menu.html?r=${restaurantId}&role=admin` : `restaurant-dashboard.html?r=${restaurantId}`;
    document.getElementById("scan-title").textContent = `Scan a menu for ${restaurant.name}`;
    document.getElementById("scan-subtitle").textContent =
      "Click as many photos of your paper menu as you need. New dishes are added to your draft menu for you to review — remove any photo with ✕, then press Done.";
    if (typeof Theme !== "undefined") Theme.ensureTheme(restaurantId, restaurant.logo);
  }

  let stream = null;
  const shots = []; // data URLs of captured/uploaded photos

  function updateDoneState() {
    doneBtn.disabled = shots.length === 0;
  }

  function addShot(dataUrl) {
    shots.push(dataUrl);
    renderShots();
  }

  function renderShots() {
    shotsStrip.innerHTML = "";
    shots.forEach((src, idx) => {
      const thumb = document.createElement("div");
      thumb.className = "shot-thumb";
      thumb.innerHTML = `<img src="${src}" alt="Shot ${idx + 1}"><button class="remove-shot" title="Remove">&#10005;</button>`;
      thumb.querySelector(".remove-shot").addEventListener("click", () => {
        shots.splice(idx, 1);
        renderShots();
      });
      shotsStrip.appendChild(thumb);
    });
    updateDoneState();
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream;
      placeholder.classList.add("hidden");
      shutterBtn.disabled = false;
      startBtn.textContent = "Stop camera";
    } catch (err) {
      placeholder.innerHTML = `📷<br>Couldn't access the camera (${err.name}).<br><span style="font-size:0.78rem;">Use "Upload photo instead" below, or try this page on HTTPS / localhost.</span>`;
    }
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    shutterBtn.disabled = true;
    placeholder.classList.remove("hidden");
    startBtn.textContent = "Start camera";
  }

  startBtn.addEventListener("click", () => {
    if (stream) stopCamera();
    else startCamera();
  });

  shutterBtn.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 640;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    addShot(canvas.toDataURL("image/jpeg", 0.85));
  });

  fallbackInput.addEventListener("change", () => {
    Array.from(fallbackInput.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => addShot(e.target.result);
      reader.readAsDataURL(file);
    });
    fallbackInput.value = "";
  });

  // Mock "what OCR would produce" — enough variety to demo the editor.
  function buildScannedCategories() {
    const pick = (i) => (shots.length ? shots[i % shots.length] : null);
    let n = 0;
    const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${(n++).toString(36)}`;
    return [
      {
        id: id("cat"),
        name: "Starters",
        items: [
          { id: id("item"), name: "Paneer Tikka", price: "210", image: pick(0), description: null },
          { id: id("item"), name: "Garlic Bread", price: "140", image: pick(1), description: null }
        ]
      },
      {
        id: id("cat"),
        name: "Main Course",
        items: [
          { id: id("item"), name: "Hakka Noodles", price: "190", image: pick(2), description: null },
          { id: id("item"), name: "Butter Chicken", price: "320", image: pick(3), description: null }
        ]
      },
      {
        id: id("cat"),
        name: "Beverages",
        items: [
          { id: id("item"), name: "Cold Coffee", price: "120", image: pick(4), description: null }
        ]
      }
    ];
  }

  doneBtn.addEventListener("click", () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    cameraStage.classList.add("hidden");
    shotsStrip.classList.add("hidden");
    doneBtn.classList.add("hidden");
    analyzingOverlay.classList.remove("hidden");

    setTimeout(() => {
      const scanned = buildScannedCategories();

      if (restaurant) {
        // An existing restaurant (new or established) scanning their own
        // menu — merge into their draft without touching what's published.
        DataStore.mergeScannedCategories(restaurant, scanned);
        DataStore.saveRestaurant(restaurantId, restaurant);
        window.location.href = `edit-menu.html?r=${restaurantId}&role=${role}`;
      } else {
        // Admin onboarding a brand-new restaurant from scratch.
        const draft = {
          id: "new-scan-draft",
          name: "New Menu Draft",
          plan: "Free plan",
          logo: null,
          categories: scanned,
          publishedCategories: []
        };
        localStorage.setItem("infinitum_menu_new-scan-draft", JSON.stringify(draft));
        window.location.href = "edit-menu.html?r=new-scan-draft&role=admin";
      }
    }, 1800);
  });

  updateDoneState();
})();
