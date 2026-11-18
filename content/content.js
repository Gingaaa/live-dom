// content/content.js - LiveDOM In-Page Visual Editor
(function () {
  if (window.__livedom_injected) return;
  window.__livedom_injected = true;

  // State
  let isEnabled = true;
  let triggerMode = 'alt'; // 'alt' or 'always'
  let isAltPressed = false;
  let hoveredElement = null;
  let selectedElement = null;
  let isDirectTextEditing = false;
  const modifiedElements = new Map(); // element -> { originalStyles, originalClasses, originalOuterHTML }
  const hiddenElements = new Map();   // element -> originalDisplay

  // Fetch initial preferences
  if (chrome?.storage?.local) {
    chrome.storage.local.get(['livedom_enabled', 'livedom_mode'], (res) => {
      if (res.livedom_enabled !== undefined) isEnabled = res.livedom_enabled;
      if (res.livedom_mode !== undefined) triggerMode = res.livedom_mode;
    });
  }

  // 1. Setup Isolated Shadow DOM Container
  const host = document.createElement('div');
  host.id = '__livedom_root__';
  host.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; z-index: 2147483647;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // Load stylesheet into Shadow Root
  const styleEl = document.createElement('link');
  styleEl.rel = 'stylesheet';
  styleEl.href = chrome.runtime.getURL('content/overlay.css');
  shadow.appendChild(styleEl);

  // Template for Overlays and Micro-Card
  const overlayContainer = document.createElement('div');
  overlayContainer.innerHTML = `
    <!-- Hover Box Indicator -->
    <div class="livedom-hover-box" id="hoverBox"></div>

    <!-- Hover Micro-Chip -->
    <div class="livedom-hover-chip" id="hoverChip">
      <span class="chip-tag" id="chipTag">div</span>
      <span class="chip-size" id="chipSize">0x0</span>
      <span class="chip-action">Click to edit</span>
    </div>

    <!-- Selected Target Box -->
    <div class="livedom-selected-box" id="selectedBox"></div>

    <!-- Main Floating Micro-Card -->
    <div class="livedom-micro-card" id="microCard">
      <!-- Header -->
      <div class="card-header">
        <div class="element-tag-title" id="cardTagTitle">&lt;div&gt;</div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button class="parent-nav-btn" id="parentNavBtn" title="Select parent element">↑ Parent</button>
          <button class="card-close-btn" id="cardCloseBtn" title="Close (Esc)">&times;</button>
        </div>
      </div>

      <!-- Classes Section -->
      <div class="section">
        <div class="section-label">
          <span>Classes</span>
          <span style="font-size: 9px; color: #94a3b8;" id="classCountLabel">0</span>
        </div>
        <div class="class-tags-container" id="classTagsContainer"></div>
        <form class="add-class-form" id="addClassForm">
          <input type="text" class="add-class-input" id="addClassInput" placeholder="+ add class (e.g. shadow-lg)" autocomplete="off">
          <button type="submit" class="add-class-btn">Add</button>
        </form>
      </div>

      <!-- Quick Typography & Style Grid -->
      <div class="section">
        <div class="section-label">Quick Styles</div>
        <div class="style-grid">
          <!-- Font Size -->
          <div class="style-control">
            <span class="style-control-label">Font Size</span>
            <div class="stepper-control">
              <button class="step-btn" id="fontDecBtn">-</button>
              <span class="step-val" id="fontSizeVal">16px</span>
              <button class="step-btn" id="fontIncBtn">+</button>
            </div>
          </div>

          <!-- Text Color -->
          <div class="style-control">
            <span class="style-control-label">Text Color</span>
            <div class="color-picker-wrapper">
              <input type="color" class="color-input" id="textColorPicker" value="#000000">
            </div>
          </div>

          <!-- Background Color -->
          <div class="style-control">
            <span class="style-control-label">Background</span>
            <div class="color-picker-wrapper">
              <input type="color" class="color-input" id="bgColorPicker" value="#ffffff">
            </div>
          </div>

          <!-- Font Weight -->
          <div class="style-control">
            <span class="style-control-label">Weight</span>
            <div class="stepper-control">
              <button class="step-btn" id="weightDecBtn">-</button>
              <span class="step-val" id="fontWeightVal">400</span>
              <button class="step-btn" id="weightIncBtn">+</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Bar -->
      <div class="action-bar">
        <button class="action-btn" id="editTextBtn" title="Type directly on the webpage">
          <span>✏️</span>
          <span>Edit Text</span>
        </button>
        <button class="action-btn" id="editHtmlBtn" title="Edit element raw HTML">
          <span>&lt; / &gt;</span>
          <span>HTML</span>
        </button>
        <button class="action-btn danger" id="hideElemBtn" title="Hide this element (display: none)">
          <span>👁️</span>
          <span>Hide</span>
        </button>
      </div>

      <!-- Direct HTML Editor Drawer -->
      <div class="html-drawer" id="htmlDrawer">
        <textarea class="html-textarea" id="htmlTextarea" spellcheck="false"></textarea>
        <div class="html-drawer-actions">
          <button class="apply-html-btn" id="applyHtmlBtn">Apply HTML</button>
        </div>
      </div>
    </div>

    <!-- Floating Bottom Pill for Hidden Elements -->
    <div class="livedom-hidden-pill" id="hiddenPill">
      <span class="pill-count">👁️ <span id="hiddenCountText">0</span> hidden</span>
      <button class="unhide-btn" id="unhideLastBtn" title="Unhide most recently hidden element">↺ Unhide</button>
      <button class="unhide-btn" id="unhideAllBtn" title="Restore all hidden elements">Unhide All</button>
    </div>
  `;
  shadow.appendChild(overlayContainer);

  // References to UI Elements inside Shadow Root
  const hoverBox = shadow.getElementById('hoverBox');
  const hoverChip = shadow.getElementById('hoverChip');
  const chipTag = shadow.getElementById('chipTag');
  const chipSize = shadow.getElementById('chipSize');
  const selectedBox = shadow.getElementById('selectedBox');
  const microCard = shadow.getElementById('microCard');
  const cardTagTitle = shadow.getElementById('cardTagTitle');
  const parentNavBtn = shadow.getElementById('parentNavBtn');
  const cardCloseBtn = shadow.getElementById('cardCloseBtn');
  const classTagsContainer = shadow.getElementById('classTagsContainer');
  const classCountLabel = shadow.getElementById('classCountLabel');
  const addClassForm = shadow.getElementById('addClassForm');
  const addClassInput = shadow.getElementById('addClassInput');
  const fontDecBtn = shadow.getElementById('fontDecBtn');
  const fontIncBtn = shadow.getElementById('fontIncBtn');
  const fontSizeVal = shadow.getElementById('fontSizeVal');
  const weightDecBtn = shadow.getElementById('weightDecBtn');
  const weightIncBtn = shadow.getElementById('weightIncBtn');
  const fontWeightVal = shadow.getElementById('fontWeightVal');
  const textColorPicker = shadow.getElementById('textColorPicker');
  const bgColorPicker = shadow.getElementById('bgColorPicker');
  const editTextBtn = shadow.getElementById('editTextBtn');
  const editHtmlBtn = shadow.getElementById('editHtmlBtn');
  const hideElemBtn = shadow.getElementById('hideElemBtn');
  const htmlDrawer = shadow.getElementById('htmlDrawer');
  const htmlTextarea = shadow.getElementById('htmlTextarea');
  const applyHtmlBtn = shadow.getElementById('applyHtmlBtn');
  const hiddenPill = shadow.getElementById('hiddenPill');
  const hiddenCountText = shadow.getElementById('hiddenCountText');
  const unhideLastBtn = shadow.getElementById('unhideLastBtn');
  const unhideAllBtn = shadow.getElementById('unhideAllBtn');

  // Helper: check if inspecting should be active
  function shouldInspect() {
    if (!isEnabled) return false;
    if (triggerMode === 'always') return true;
    return isAltPressed;
  }

  // Helper: check if element belongs to our overlay
  function isLiveDOMElement(el) {
    return el === host || host.contains(el);
  }

  // Track original properties before first change
  function recordInitialState(el) {
    if (!modifiedElements.has(el)) {
      modifiedElements.set(el, {
        originalStyle: el.getAttribute('style') || '',
        originalClasses: el.getAttribute('class') || '',
        originalOuterHTML: el.outerHTML
      });
    }
  }

  // 2. Keyboard Listeners (Alt trigger and Escape to close)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt') {
      isAltPressed = true;
      if (hoveredElement && !selectedElement && shouldInspect()) {
        updateHoverOverlay(hoveredElement);
      }
    } else if (e.key === 'Escape') {
      dismissSelection();
    }
  }, { capture: true });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') {
      isAltPressed = false;
      if (triggerMode === 'alt' && !selectedElement) {
        hideHoverOverlay();
      }
    }
  }, { capture: true });

  // 3. Mouse Move Hover Detection
  window.addEventListener('mousemove', (e) => {
    if (isDirectTextEditing) return;

    const target = e.target;
    if (!target || isLiveDOMElement(target) || target === document.documentElement || target === document.body) {
      if (!selectedElement) hideHoverOverlay();
      return;
    }

    // If mouse moves to a different element while an element was selected,
    // in inspect mode we dismiss the previous selection so hover indicator appears immediately
    if (shouldInspect() && selectedElement && selectedElement !== target && !selectedElement.contains(target)) {
      dismissSelection();
    }

    hoveredElement = target;

    if (shouldInspect()) {
      updateHoverOverlay(target);
    } else {
      hideHoverOverlay();
    }
  }, { passive: true });

  function updateHoverOverlay(el) {
    if (!el || !document.body.contains(el)) {
      hideHoverOverlay();
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Update hover box
    hoverBox.style.top = `${rect.top}px`;
    hoverBox.style.left = `${rect.left}px`;
    hoverBox.style.width = `${rect.width}px`;
    hoverBox.style.height = `${rect.height}px`;
    hoverBox.classList.add('active');

    // Update hover micro-chip
    const tagName = el.tagName.toLowerCase();
    const idStr = el.id ? `#${el.id}` : '';
    const classStr = el.classList.length > 0 ? `.${Array.from(el.classList).slice(0, 2).join('.')}` : '';
    chipTag.textContent = `${tagName}${idStr}${classStr}`;
    chipSize.textContent = `${Math.round(rect.width)}×${Math.round(rect.height)}`;

    // Position chip: prefer above the element, or inside/below if near screen top
    let chipTop = rect.top - 26;
    if (chipTop < 6) chipTop = rect.top + 6;
    if (chipTop + 30 > window.innerHeight) chipTop = window.innerHeight - 36;
    let chipLeft = Math.max(6, Math.min(rect.left, window.innerWidth - 220));

    hoverChip.style.top = `${chipTop}px`;
    hoverChip.style.left = `${chipLeft}px`;
    hoverChip.style.display = 'flex';
  }

  function hideHoverOverlay() {
    hoverBox.classList.remove('active');
    hoverChip.style.display = 'none';
  }

  // 4. Click Capture to Select Element
  window.addEventListener('click', (e) => {
    if (!isEnabled) return;
    if (isLiveDOMElement(e.target)) return;

    if (shouldInspect() || isAltPressed) {
      e.preventDefault();
      e.stopPropagation();
      selectTargetElement(e.target);
    }
  }, { capture: true });

  hoverChip.addEventListener('click', (e) => {
    e.stopPropagation();
    if (hoveredElement) {
      selectTargetElement(hoveredElement);
    }
  });

  // 5. Select & Open Micro-Card
  function selectTargetElement(el) {
    if (!el || isLiveDOMElement(el)) return;
    selectedElement = el;
    recordInitialState(el);
    hideHoverOverlay();

    updateSelectedBox(el);
    renderMicroCard(el);
  }

  function updateSelectedBox(el) {
    const rect = el.getBoundingClientRect();
    selectedBox.style.top = `${rect.top}px`;
    selectedBox.style.left = `${rect.left}px`;
    selectedBox.style.width = `${rect.width}px`;
    selectedBox.style.height = `${rect.height}px`;
    selectedBox.classList.add('active');
  }

  function renderMicroCard(el) {
    const rect = el.getBoundingClientRect();
    const tagName = el.tagName.toLowerCase();
    const idStr = el.id ? `#${el.id}` : '';
    cardTagTitle.textContent = `<${tagName}${idStr}>`;

    // Parent nav button availability
    if (el.parentElement && el.parentElement !== document.body && el.parentElement !== document.documentElement) {
      parentNavBtn.style.display = 'inline-flex';
    } else {
      parentNavBtn.style.display = 'none';
    }

    // Refresh classes
    renderClasses(el);

    // Refresh Computed Styles
    const computed = window.getComputedStyle(el);
    const fontSize = parseInt(computed.fontSize, 10) || 16;
    fontSizeVal.textContent = `${fontSize}px`;

    const fontWeight = computed.fontWeight || '400';
    fontWeightVal.textContent = fontWeight;

    // RGB to Hex helper
    textColorPicker.value = rgbToHex(computed.color) || '#000000';
    bgColorPicker.value = rgbToHex(computed.backgroundColor) || '#ffffff';

    // Reset direct text editing button state
    editTextBtn.classList.remove('active');
    isDirectTextEditing = false;
    el.contentEditable = 'false';

    // Reset HTML drawer
    htmlDrawer.classList.remove('open');
    editHtmlBtn.classList.remove('active');

    // Position Card smartly: avoid screen edges & tablet viewports
    positionCard(rect);
    microCard.classList.add('active');
  }

  function positionCard(targetRect) {
    const cardWidth = 330;
    const margin = 12;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Constrain max height so the popup never exceeds viewport height
    const maxAllowedHeight = winHeight - (2 * margin);
    microCard.style.maxHeight = `${maxAllowedHeight}px`;

    // Measure actual rendered height of card
    const wasActive = microCard.classList.contains('active');
    if (!wasActive) {
      microCard.style.visibility = 'hidden';
      microCard.classList.add('active');
    }
    const cardHeight = Math.min(microCard.offsetHeight || 320, maxAllowedHeight);
    if (!wasActive) {
      microCard.classList.remove('active');
      microCard.style.visibility = '';
    }

    // Horizontal placement: align with target left, clamp inside screen
    let left = targetRect.left;
    if (left + cardWidth > winWidth - margin) {
      left = winWidth - cardWidth - margin;
    }
    if (left < margin) left = margin;

    // Vertical placement logic:
    const spaceBelow = winHeight - targetRect.bottom - margin;
    const spaceAbove = targetRect.top - margin;

    let top;
    if (spaceBelow >= cardHeight) {
      // Fits comfortably below target
      top = targetRect.bottom + margin;
    } else if (spaceAbove >= cardHeight) {
      // Fits comfortably above target
      top = targetRect.top - cardHeight - margin;
    } else if (spaceBelow >= spaceAbove) {
      // More space below than above, pin within bottom bound
      top = Math.max(margin, winHeight - cardHeight - margin);
    } else {
      // More space above than below, pin within top bound
      top = margin;
    }

    microCard.style.top = `${top}px`;
    microCard.style.left = `${left}px`;
  }

  // Re-position on scroll or resize
  window.addEventListener('scroll', () => {
    if (selectedElement) {
      updateSelectedBox(selectedElement);
      positionCard(selectedElement.getBoundingClientRect());
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (selectedElement) {
      updateSelectedBox(selectedElement);
      positionCard(selectedElement.getBoundingClientRect());
    }
  }, { passive: true });

  // 6. Dismiss Selection
  function dismissSelection() {
    if (selectedElement) {
      selectedElement.contentEditable = 'false';
    }
    selectedElement = null;
    isDirectTextEditing = false;
    selectedBox.classList.remove('active');
    microCard.classList.remove('active');
  }

  cardCloseBtn.addEventListener('click', dismissSelection);

  // 7. Parent Navigation
  parentNavBtn.addEventListener('click', () => {
    if (selectedElement && selectedElement.parentElement) {
      selectTargetElement(selectedElement.parentElement);
    }
  });

  // 8. Class Manager Handlers
  function renderClasses(el) {
    classTagsContainer.innerHTML = '';
    const classes = Array.from(el.classList);
    classCountLabel.textContent = classes.length;

    if (classes.length === 0) {
      classTagsContainer.innerHTML = '<span style="font-size: 10px; color: #64748b; font-style: italic;">No classes applied</span>';
      return;
    }

    classes.forEach(cls => {
      const tag = document.createElement('div');
      tag.className = 'class-tag';
      tag.innerHTML = `
        <span>.${cls}</span>
        <span class="class-tag-remove" data-cls="${cls}" title="Remove class">&times;</span>
      `;
      classTagsContainer.appendChild(tag);
    });

    // Remove class event
    classTagsContainer.querySelectorAll('.class-tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const clsToRemove = btn.getAttribute('data-cls');
        if (selectedElement) {
          selectedElement.classList.remove(clsToRemove);
          renderClasses(selectedElement);
          updateSelectedBox(selectedElement);
        }
      });
    });
  }

  addClassForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedElement) return;

    const val = addClassInput.value.trim();
    if (val) {
      const classNames = val.split(/\s+/);
      classNames.forEach(c => {
        if (c.startsWith('.')) c = c.slice(1);
        if (c) selectedElement.classList.add(c);
      });
      addClassInput.value = '';
      renderClasses(selectedElement);
      updateSelectedBox(selectedElement);
    }
  });

  // 9. Quick Typography Steppers
  fontIncBtn.addEventListener('click', () => {
    if (!selectedElement) return;
    const current = parseInt(window.getComputedStyle(selectedElement).fontSize, 10) || 16;
    const next = current + 1;
    selectedElement.style.fontSize = `${next}px`;
    fontSizeVal.textContent = `${next}px`;
    updateSelectedBox(selectedElement);
  });

  fontDecBtn.addEventListener('click', () => {
    if (!selectedElement) return;
    const current = parseInt(window.getComputedStyle(selectedElement).fontSize, 10) || 16;
    const next = Math.max(8, current - 1);
    selectedElement.style.fontSize = `${next}px`;
    fontSizeVal.textContent = `${next}px`;
    updateSelectedBox(selectedElement);
  });

  weightIncBtn.addEventListener('click', () => {
    if (!selectedElement) return;
    const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
    const current = parseInt(window.getComputedStyle(selectedElement).fontWeight, 10) || 400;
    const next = weights.find(w => w > current) || 900;
    selectedElement.style.fontWeight = String(next);
    fontWeightVal.textContent = next;
  });

  weightDecBtn.addEventListener('click', () => {
    if (!selectedElement) return;
    const weights = [900, 800, 700, 600, 500, 400, 300, 200, 100];
    const current = parseInt(window.getComputedStyle(selectedElement).fontWeight, 10) || 400;
    const next = weights.find(w => w < current) || 100;
    selectedElement.style.fontWeight = String(next);
    fontWeightVal.textContent = next;
  });

  // Color Pickers
  textColorPicker.addEventListener('input', (e) => {
    if (!selectedElement) return;
    selectedElement.style.color = e.target.value;
  });

  bgColorPicker.addEventListener('input', (e) => {
    if (!selectedElement) return;
    selectedElement.style.backgroundColor = e.target.value;
  });

  // 10. Direct Text Editing
  editTextBtn.addEventListener('click', () => {
    if (!selectedElement) return;
    isDirectTextEditing = !isDirectTextEditing;
    if (isDirectTextEditing) {
      editTextBtn.classList.add('active');
      selectedElement.contentEditable = 'true';
      selectedElement.focus();
    } else {
      editTextBtn.classList.remove('active');
      selectedElement.contentEditable = 'false';
    }
  });

  // 11. Direct HTML Drawer
  editHtmlBtn.addEventListener('click', () => {
    if (!selectedElement) return;
    const isOpen = htmlDrawer.classList.toggle('open');
    editHtmlBtn.classList.toggle('active', isOpen);
    if (isOpen) {
      htmlTextarea.value = selectedElement.outerHTML;
      htmlTextarea.focus();
    }
    // Re-position smoothly to fit updated height within viewport
    positionCard(selectedElement.getBoundingClientRect());
  });

  applyHtmlBtn.addEventListener('click', () => {
    if (!selectedElement) return;
    const newHtml = htmlTextarea.value.trim();
    if (newHtml) {
      const tempWrapper = document.createElement('div');
      tempWrapper.innerHTML = newHtml;
      const newEl = tempWrapper.firstElementChild;
      if (newEl) {
        selectedElement.replaceWith(newEl);
        selectTargetElement(newEl);
      }
    }
  });

  // 12. Hide & Unhide Elements
  function updateHiddenPill() {
    const count = hiddenElements.size;
    if (count > 0 && isEnabled) {
      hiddenCountText.textContent = count;
      hiddenPill.classList.add('active');
    } else {
      hiddenPill.classList.remove('active');
    }
  }

  function unhideElement(el) {
    if (!el || !hiddenElements.has(el)) return;
    const prevDisplay = hiddenElements.get(el);
    if (prevDisplay) {
      el.style.display = prevDisplay;
    } else {
      el.style.removeProperty('display');
    }
    hiddenElements.delete(el);
    updateHiddenPill();
  }

  function unhideAllElements() {
    hiddenElements.forEach((prevDisplay, el) => {
      if (document.body.contains(el)) {
        if (prevDisplay) {
          el.style.display = prevDisplay;
        } else {
          el.style.removeProperty('display');
        }
      }
    });
    hiddenElements.clear();
    updateHiddenPill();
  }

  hideElemBtn.addEventListener('click', () => {
    if (!selectedElement) return;
    recordInitialState(selectedElement);
    const prevDisplay = selectedElement.style.display || '';
    hiddenElements.set(selectedElement, prevDisplay);
    selectedElement.style.display = 'none';
    updateHiddenPill();
    dismissSelection();
  });

  unhideLastBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const hiddenKeys = Array.from(hiddenElements.keys());
    if (hiddenKeys.length > 0) {
      const lastHidden = hiddenKeys[hiddenKeys.length - 1];
      unhideElement(lastHidden);
      selectTargetElement(lastHidden);
    }
  });

  unhideAllBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    unhideAllElements();
  });

  // Helper: RGB/RGBA string to Hex
  function rgbToHex(rgbStr) {
    if (!rgbStr) return null;
    const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  // 13. Chrome Runtime Message Listener (Popup interactions)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'toggle':
        isEnabled = request.enabled;
        if (!isEnabled) {
          dismissSelection();
          hideHoverOverlay();
          hiddenPill.classList.remove('active');
        } else {
          updateHiddenPill();
        }
        sendResponse({ status: 'ok', enabled: isEnabled });
        break;

      case 'setMode':
        triggerMode = request.mode;
        sendResponse({ status: 'ok', mode: triggerMode });
        break;

      case 'getStats':
        sendResponse({
          modifiedCount: modifiedElements.size,
          hiddenCount: hiddenElements.size
        });
        break;

      case 'unhideAll':
        unhideAllElements();
        sendResponse({ status: 'ok', hiddenCount: 0 });
        break;

      case 'exportCSS': {
        let cssRules = [];
        modifiedElements.forEach((original, el) => {
          if (!document.body.contains(el)) return;
          const currentStyle = el.getAttribute('style');
          if (currentStyle && currentStyle !== original.originalStyle) {
            const selector = generateUniqueSelector(el);
            cssRules.push(`${selector} {\n  ${currentStyle.split(';').map(s => s.trim()).filter(Boolean).join(';\n  ')};\n}`);
          }
        });
        sendResponse({ css: cssRules.join('\n\n') });
        break;
      }

      case 'exportHTML': {
        // Clone document and remove our host before returning
        const clone = document.documentElement.cloneNode(true);
        const hostInClone = clone.querySelector('#__livedom_root__');
        if (hostInClone) hostInClone.remove();
        sendResponse({ html: '<!DOCTYPE html>\n' + clone.outerHTML });
        break;
      }

      case 'reset': {
        unhideAllElements();
        modifiedElements.forEach((original, el) => {
          if (document.body.contains(el)) {
            if (original.originalStyle) {
              el.setAttribute('style', original.originalStyle);
            } else {
              el.removeAttribute('style');
            }
            if (original.originalClasses) {
              el.setAttribute('class', original.originalClasses);
            } else {
              el.removeAttribute('class');
            }
          }
        });
        modifiedElements.clear();
        dismissSelection();
        sendResponse({ status: 'reset_complete' });
        break;
      }
    }
    return true; // Keep message channel open for async response
  });

  // Unique CSS selector generator for clean export
  function generateUniqueSelector(el) {
    if (el.id) return `#${el.id}`;
    let path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body && el !== document.documentElement) {
      let selector = el.nodeName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const classes = Array.from(el.classList).slice(0, 2).join('.');
        if (classes) selector += `.${classes}`;
      }
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(' > ');
  }
})();
