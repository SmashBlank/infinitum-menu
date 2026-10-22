/* ==========================================================================
   Infinitum — "Scan new menu" camera flow
   Used by both Admin (onboarding a brand-new restaurant) and restaurant
   owners (scanning their own paper menu). Snaps multiple photos, lets you
   remove any before finishing, then simulates analyzing them into
   categories/items. Real OCR is a later phase — this wires up the full UX
   so it can be swapped in without a redesign. Scanned results are merged
   into the restaurant's *draft* menu only — customers won't see anything
   until it's Published in the editor.
   ========================================================================== */

(function () {
  const params = new URLSearchParams(window.location.search);
  const restaurantId = params.get("r");
  const role = params.get("role") === "admin" ? "admin" : "restaurant";

  const video = document.getElementById("camera-video");
  const placeholder = document.getElementById("camera-placeholder");
  const startBtn = document.getElementById("start-camera-btn");
  const shutterBtn = document.getElementById("shutter-btn");
  const doneBtn = document.getElementById("done-btn");
  const shotsStrip = document.getElementById("shots-strip");
  const fallbackInput = document.getElementById("fallback-file-input");
  const analyzingOverlay = document.getElementById("analyzing-overlay");
  const cameraStage = document.getElementById("camera-stage");

  let stream = null;
  const shots = []; // { dataUrl, file } for each captured/uploaded photo

  function updateDoneState() {
    doneBtn.disabled = shots.length === 0;
  }

  function dataUrlToFile(dataUrl, filename) {
    const [header, base64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  }

  function addShot(dataUrl, file) {
    shots.push({ dataUrl, file });
    renderShots();
  }

  function renderShots() {
    shotsStrip.innerHTML = "";
    shots.forEach((shot, idx) => {
      const thumb = document.createElement("div");
      thumb.className = "shot-thumb";
      thumb.innerHTML = `<img src="${shot.dataUrl}" alt="Shot ${idx + 1}"><button class="remove-shot" title="Remove">&#10005;</button>`;
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    addShot(dataUrl, dataUrlToFile(dataUrl, `shot-${Date.now()}.jpg`));
  });

  fallbackInput.addEventListener("change", () => {
    Array.from(fallbackInput.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => addShot(e.target.result, file);
      reader.readAsDataURL(file);
    });
    fallbackInput.value = "";
  });

  // Mock "what OCR would produce" — enough variety to demo the editor.
  // `images` is a list of already-uploaded Supabase Storage URLs.
  function buildScannedCategories(images) {
    const pick = (i) => (images.length ? images[i % images.length] : null);
    return [
      {
        name: "Starters",
        items: [
          { name: "Paneer Tikka", price: "210", image: pick(0), description: null },
          { name: "Garlic Bread", price: "140", image: pick(1), description: null }
        ]
      },
      {
        name: "Main Course",
        items: [
          { name: "Hakka Noodles", price: "190", image: pick(2), description: null },
          { name: "Butter Chicken", price: "320", image: pick(3), description: null }
        ]
      },
      {
        name: "Beverages",
        items: [
          { name: "Cold Coffee", price: "120", image: pick(4), description: null }
        ]
      }
    ];
  }

  doneBtn.addEventListener("click", async () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    cameraStage.classList.add("hidden");
    shotsStrip.classList.add("hidden");
    doneBtn.classList.add("hidden");
    analyzingOverlay.classList.remove("hidden");

    try {
      const uploadedUrls = [];
      for (const shot of shots) {
        const url = await DataStore.uploadImage("dish-images", shot.file, restaurantId);
        uploadedUrls.push(url);
      }
      const scanned = buildScannedCategories(uploadedUrls);
      await DataStore.mergeScannedCategories(restaurantId, scanned);
      window.location.href = `edit-menu.html?r=${restaurantId}&role=${role}`;
    } catch (err) {
      alert("Something went wrong analyzing your photos: " + err.message);
      analyzingOverlay.classList.add("hidden");
      cameraStage.classList.remove("hidden");
      shotsStrip.classList.remove("hidden");
      doneBtn.classList.remove("hidden");
    }
  });

  updateDoneState();

  (async function init() {
    const profile = await Auth.requireProfile();
    if (!profile) return;
    if (profile.role === "restaurant" && profile.restaurant_id !== restaurantId) {
      window.location.href = `restaurant-dashboard.html?r=${profile.restaurant_id}`;
      return;
    }

    const restaurant = await DataStore.getRestaurant(restaurantId);
    if (!restaurant) {
      document.querySelector("main").innerHTML = "<p>Unknown restaurant.</p>";
      return;
    }

    document.getElementById("brand-name").textContent = restaurant.name;
    document.getElementById("brand-link").href = `restaurant-dashboard.html?r=${restaurantId}`;
    document.getElementById("cancel-link").href =
      role === "admin" ? `edit-menu.html?r=${restaurantId}&role=admin` : `restaurant-dashboard.html?r=${restaurantId}`;
    document.getElementById("scan-title").textContent = `Scan a menu for ${restaurant.name}`;
    document.getElementById("scan-subtitle").textContent =
      "Click as many photos of your paper menu as you need. New dishes are added to your draft menu for you to review — remove any photo with ✕, then press Done.";
    const themeState = restaurant.theme || Theme.defaultState();
    Theme.applyVars(themeState.vars);
  })();
})();
