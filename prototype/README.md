# Infinitum — Visual Prototype

This folder is a **clickable design prototype** of your digital-menu website. It is real
HTML/CSS/JavaScript — not a mockup image — but it uses **fake sample data** stored in your
browser instead of a real database, so nothing here is connected to the internet or to any
real restaurant yet. Think of it as a "model home" you can walk through before we build the
real plumbing and wiring.

## How to look at it

**Easiest way:** just double-click `index.html` and it opens in your browser. Click around
from there — every page links to the next one.

**For the "Scan new menu" camera page specifically:** phones and browsers block camera
access on a plain double-clicked file. To try that one page with a real camera, you need a
"local server" running. If you have VS Code, the simplest way is the **Live Server**
extension (right-click `index.html` → "Open with Live Server"). Everything else works fine
without this.

## What's in here

| Page | What it is |
|---|---|
| `index.html` | Public homepage — intro, highlights, how it works, contact |
| `login.html` | Login screen with a toggle for Restaurant vs Admin (demo only, any password works) |
| `admin-dashboard.html` | Your (the company's) admin view — list of all restaurants, "scan new menu" button |
| `restaurant-dashboard.html` | A restaurant's own homepage after logging in — profile, plan, **logo upload & color theme** |
| `edit-menu.html` | The menu editor — categories on top, item "tiles" below, used by both admin and restaurants |
| `menu-view.html` | **The actual digital menu customers would see** when they scan a QR code or open the link |
| `scan-menu.html` | The "click photos of your paper menu" camera flow |

Three sample restaurants are pre-loaded so you can compare how the **logo colors change the
whole page's look**: try `menu-view.html?r=green-leaf-cafe`, `?r=spice-route`, and
`?r=blue-wave-pizza`. You can also upload your own test logo on the restaurant dashboard and
watch the background/accent colors update live.

## What's real vs. what's simulated right now

- **Real and working:** the minimalist design, all navigation, the menu editor (add/edit/
  reorder/delete items & categories, move an item to another category), default dish
  descriptions, default placeholder images, and — the headline feature — **automatic color
  theming from an uploaded logo**.
- **Simulated for now (no backend yet):** logging in (any email/password "works"), saving
  data (it's saved to your browser only, via `localStorage`, not a real database), and
  reading text off a photographed menu (the scan page fakes this with sample data after a
  couple of seconds, to show you the flow).

## What happens next

Once you're happy with how this looks and behaves, the next phase is to make it "real":

1. **A real database** — to store every restaurant's menu, logo, and images properly
   instead of just in one browser.
2. **Real logins** — proper passwords, so restaurants can only see/edit their own menu.
3. **Real photo-to-text reading (OCR)** — so a photographed menu is actually turned into
   items, prices, and categories automatically.
4. **Hosting** — putting the site on the internet with a real web address.

Because you mentioned you're not technical, when we get to that phase I'll recommend tools
that are specifically built to be beginner-friendly (free to start, no server management,
mostly point-and-click setup with step-by-step guidance from me) rather than anything that
needs you to run your own servers.
