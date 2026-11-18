# LiveDOM - In-Page Visual Web Editor (Browser Extension)

> A lightweight, non-intrusive browser extension that lets you edit CSS, add/remove classes, tweak typography, and edit HTML live on any webpage **without opening DevTools or heavy sidebars**.

---

## ✨ Features

- **Zero Screen Clutter:** No side panels or heavy drawers. A floating, compact micro-card appears right next to the element you interact with and disappears when you're done. Perfect for tablet viewports and responsive testing.
- **Shadow DOM Isolation:** LiveDOM's UI is injected into an isolated Shadow DOM container. The target website's CSS can never break the extension's UI, and the extension's styles will never leak into the host page.
- **Smart Viewport Positioning:** Uses boundary detection to position the micro-card below, above, or inwards so it never overflows off-screen on mobile or tablet screen sizes.
- **Class Pill Manager:** View all active classes on the element as removable chips (`×`), and instantly type and add new classes (e.g., Tailwind or custom classes).
- **Live Typography & Color Controls:**
  - Font Size stepper (`-` / `+`)
  - Font Weight stepper (`100` to `900`)
  - Text color & background color pickers
- **Direct In-Page Text Editing:** Click "✏️ Edit Text" to toggle `contentEditable` and type directly on the live webpage.
- **Inline HTML Drawer:** Expand `< > HTML` to edit the element's raw HTML and apply changes live.
- **Hide & Instant Unhide:** Click "👁️ Hide" to remove any element from view. A sleek, minimal pill appears in the bottom corner (`👁️ 1 hidden | ↺ Unhide | Unhide All`) so you can bring elements back with one click without cluttering the page!
- **Parent Navigator:** Quickly zoom out to the element's container with the `↑ Parent` button.
- **Export & Persistence:** Copy all accumulated CSS changes or download the modified HTML page from the extension popup.

---

## 🚀 How to Install and Test in Chrome / Edge / Brave

1. Open your browser and navigate to:
   - **Chrome:** `chrome://extensions/`
   - **Brave:** `brave://extensions/`
   - **Edge:** `edge://extensions/`
2. Turn **ON** the **Developer mode** toggle (top right corner).
3. Click the **Load unpacked** button.
4. Select the project folder:
   `f:\Open Source Countributions\Browser Extention`
5. The **LiveDOM** extension will now be active in your toolbar!

---

## 🎮 How to Test with the Included Demo Page

1. In your browser, open the included test page:
   `file:///f:/Open%20Source%20Countributions/Browser%20Extention/test-page/index.html`
   *(or drag `test-page/index.html` into a browser tab)*.
2. **Hold `Alt`** (or `Option` on macOS) and hover over any button, heading, or card.
   - You will see a dashed highlight and a sleek micro-chip (e.g. `h1#heroHeadline`).
3. **Click the element** to open the floating micro-card:
   - **Add a class:** Type `highlight-red` or `shadow-glow` and press Enter.
   - **Change Font Size:** Click `+` or `-` to scale text in real-time.
   - **Edit Text:** Click `✏️ Edit Text` and edit the headline text directly on the page!
   - **Edit HTML:** Click `< / > HTML`, change the markup, and click `Apply HTML`.
4. Press `Esc` or click `×` to close the micro-card.

---

## 📂 Project Structure

```text
├── manifest.json            # Manifest V3 extension configuration
├── content/
│   ├── content.js           # Core DOM inspector, Shadow DOM & event handlers
│   └── overlay.css          # Glassmorphism styling for the in-page micro-card
├── popup/
│   ├── popup.html           # Extension popup UI
│   ├── popup.css            # Extension popup styling
│   └── popup.js             # Communication & export logic
├── icons/
│   ├── icon16.png           # 16x16 icon
│   ├── icon48.png           # 48x48 icon
│   └── icon128.png          # 128x128 icon
├── test-page/
│   └── index.html           # Realistic test page with sample elements & classes
└── README.md                # Documentation & instructions
```
