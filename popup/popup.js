// popup/popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const inspectToggle = document.getElementById('inspectToggle');
  const statusPill = document.getElementById('statusPill');
  const modeRadios = document.querySelectorAll('input[name="triggerMode"]');
  const modifiedCountEl = document.getElementById('modifiedCount');
  const hiddenStatsRow = document.getElementById('hiddenStatsRow');
  const hiddenCountEl = document.getElementById('hiddenCount');
  const unhidePopupBtn = document.getElementById('unhidePopupBtn');
  const copyCssBtn = document.getElementById('copyCssBtn');
  const exportHtmlBtn = document.getElementById('exportHtmlBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Load saved preferences from chrome.storage
  const stored = await chrome.storage.local.get(['livedom_enabled', 'livedom_mode']);
  const isEnabled = stored.livedom_enabled ?? true;
  const currentMode = stored.livedom_mode ?? 'alt';

  inspectToggle.checked = isEnabled;
  updateStatusUI(isEnabled);

  modeRadios.forEach(r => {
    r.checked = (r.value === currentMode);
    r.addEventListener('change', async (e) => {
      const mode = e.target.value;
      await chrome.storage.local.set({ livedom_mode: mode });
      sendTabMessage({ action: 'setMode', mode });
    });
  });

  // Toggle Inspect Mode
  inspectToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.local.set({ livedom_enabled: enabled });
    updateStatusUI(enabled);
    sendTabMessage({ action: 'toggle', enabled });
  });

  function updateStatusUI(active) {
    if (active) {
      statusPill.textContent = 'Active';
      statusPill.classList.add('active');
    } else {
      statusPill.textContent = 'Inactive';
      statusPill.classList.remove('active');
    }
  }

  // Send message helper to current active tab
  async function sendTabMessage(msg) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return null;
      return await chrome.tabs.sendMessage(tab.id, msg);
    } catch (err) {
      console.warn('Could not communicate with content script:', err);
      return null;
    }
  }

  // Fetch initial stats from the current page
  async function fetchStats() {
    const res = await sendTabMessage({ action: 'getStats' });
    if (res) {
      if (typeof res.modifiedCount === 'number') {
        modifiedCountEl.textContent = res.modifiedCount;
      }
      if (typeof res.hiddenCount === 'number' && res.hiddenCount > 0) {
        hiddenCountEl.textContent = res.hiddenCount;
        hiddenStatsRow.style.display = 'flex';
      } else {
        hiddenStatsRow.style.display = 'none';
      }
    }
  }
  fetchStats();

  // Unhide All from Popup
  unhidePopupBtn.addEventListener('click', async () => {
    await sendTabMessage({ action: 'unhideAll' });
    hiddenStatsRow.style.display = 'none';
  });

  // Copy CSS Action
  copyCssBtn.addEventListener('click', async () => {
    const res = await sendTabMessage({ action: 'exportCSS' });
    if (res && res.css) {
      await navigator.clipboard.writeText(res.css);
      const originalText = copyCssBtn.innerHTML;
      copyCssBtn.innerHTML = '✓ Copied!';
      setTimeout(() => { copyCssBtn.innerHTML = originalText; }, 1500);
    } else {
      alert('No CSS changes recorded yet. Click on any element to edit styles or classes!');
    }
  });

  // Export HTML Action
  exportHtmlBtn.addEventListener('click', async () => {
    const res = await sendTabMessage({ action: 'exportHTML' });
    if (res && res.html) {
      const blob = new Blob([res.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited-page-${Date.now()}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });

  // Reset Changes Action
  resetBtn.addEventListener('click', async () => {
    if (confirm('Revert all style & class changes on this page?')) {
      await sendTabMessage({ action: 'reset' });
      modifiedCountEl.textContent = '0';
      hiddenStatsRow.style.display = 'none';
    }
  });
});
