<script setup lang="ts">
import { ref, computed } from 'vue';

// --- STATE ---
const textInput = ref('');
const status = ref<{ type: 'success' | 'warning' | 'error'; title: string; message: string } | null>(null);
const invalidLinks = ref<string[]>([]);
const showPopupHelper = ref(false);

// --- COMPUTED ---
// Helper to count valid links dynamically if needed, 
// strictly for display or validation before action.
const linkCount = computed(() => {
  return textInput.value.split('\n').filter(l => l.trim().length > 0).length;
});

// --- METHODS ---
const processAndOpen = () => {
  // Reset UI states
  status.value = null;
  invalidLinks.value = [];
  showPopupHelper.value = false;

  const lines = textInput.value.split('\n');
  const validLinks: string[] = [];
  const invalidLinesArr: string[] = [];

  // 1. Parse and Validate
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    // Heuristic: Spaces usually mean it's not a direct URL paste
    if (trimmed.includes(' ')) {
      invalidLinesArr.push(trimmed);
      return;
    }

    // Normalize URL
    let urlToTest = trimmed;
    if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
      urlToTest = 'https://' + urlToTest;
    }

    try {
      const urlObj = new URL(urlToTest);
      // Basic domain check
      if (urlObj.hostname.includes('.')) {
        validLinks.push(urlToTest);
      } else {
        invalidLinesArr.push(trimmed);
      }
    } catch (e) {
      invalidLinesArr.push(trimmed);
    }
  });

  invalidLinks.value = invalidLinesArr;

  // Handle Empty State
  if (validLinks.length === 0 && invalidLinesArr.length === 0) {
    status.value = { type: 'error', title: 'Empty Input', message: 'Please paste some links first.' };
    return;
  }

  // Handle No Valid Links
  if (validLinks.length === 0) {
    status.value = { type: 'error', title: 'No Valid Links', message: 'None of the text looked like a valid URL.' };
    return;
  }

  // 2. Open Links
  let successCount = 0;
  let blocked = false;

  validLinks.forEach(url => {
    const newWindow = window.open(url, '_blank');
    // Check for popup blocker
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
      blocked = true;
    } else {
      successCount++;
    }
  });

  // 3. Status Reporting
  if (blocked && successCount <= 1) {
    status.value = { type: 'warning', title: 'Pop-ups Blocked', message: `Opened ${successCount} link(s), but others were blocked.` };
    showPopupHelper.value = true;
  } else if (invalidLinesArr.length > 0) {
    status.value = { type: 'warning', title: 'Completed with Warnings', message: `Opened ${validLinks.length} links. Skipped ${invalidLinesArr.length} invalid lines.` };
  } else {
    status.value = { type: 'success', title: 'Success', message: `Successfully opened ${validLinks.length} links.` };
  }
};

const clearForm = () => {
  textInput.value = '';
  status.value = null;
  invalidLinks.value = [];
  showPopupHelper.value = false;
};
</script>

<template>
  <div class="card">
    <div class="header">
      <h2>Bulk Link Opener</h2>
      <span class="badge" v-if="linkCount > 0">{{ linkCount }} lines</span>
    </div>

    <!-- Status Messages -->
    <div v-if="status" :class="['status-box', status.type]">
      <strong>{{ status.title }}</strong>
      <p>{{ status.message }}</p>
      
      <!-- Invalid Links List -->
      <div v-if="invalidLinks.length > 0" class="invalid-list">
        <span>Skipped:</span>
        <ul>
          <li v-for="(line, index) in invalidLinks" :key="index">
            {{ line.length > 40 ? line.substring(0, 37) + '...' : line }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Popup Helper (Warning) -->
    <div v-if="showPopupHelper" class="status-box warning popup-helper">
      <strong>Browser blocked the tabs?</strong>
      <ol>
        <li>Check the address bar for a 🚫 icon.</li>
        <li>Click "Always allow pop-ups from this site".</li>
        <li>Click <b>Open Links</b> again.</li>
      </ol>
    </div>

    <!-- Input Area -->
    <div class="input-wrapper">
      <textarea 
        v-model="textInput" 
        placeholder="https://medium.com/@example&#10;www.google.com&#10;(One link per line)"
      ></textarea>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button @click="processAndOpen" class="control-button primary">
        Open Links
      </button>
      <button @click="clearForm" class="control-button secondary">
        Clear
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Reuse variables from your design system */
.card {
  max-width: 500px;
  margin: 2rem auto;
  padding: 32px;
  border-radius: 20px;
  background: var(--bg-color, #e0e5ec);
  box-shadow: 
    9px 9px 16px var(--shadow-dark, #a3b1c6), 
    -9px -9px 16px var(--shadow-light, #ffffff);
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: var(--text-primary, #1d1d1f);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #1d1d1f);
}

.badge {
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 12px;
  color: var(--text-secondary, #6e6e73);
  box-shadow: 
    inset 2px 2px 5px var(--shadow-dark, #a3b1c6), 
    inset -2px -2px 5px var(--shadow-light, #ffffff);
}

/* Inset Textarea Style */
.input-wrapper {
  width: 100%;
}

textarea {
  width: 100%;
  height: 200px;
  padding: 16px;
  border: none;
  border-radius: 16px;
  background: var(--bg-color, #e0e5ec);
  color: var(--text-primary, #1d1d1f);
  font-family: monospace;
  font-size: 0.9rem;
  resize: vertical;
  outline: none;
  /* Neumorphic Inset Shadow for Input */
  box-shadow: 
    inset 4px 4px 8px var(--shadow-dark, #a3b1c6), 
    inset -4px -4px 8px var(--shadow-light, #ffffff);
  transition: box-shadow 0.2s;
}

textarea:focus {
  box-shadow: 
    inset 6px 6px 12px var(--shadow-dark, #a3b1c6), 
    inset -6px -6px 12px var(--shadow-light, #ffffff);
}

textarea::placeholder {
  color: var(--text-secondary, #9aa0a6);
}

/* Controls */
.controls {
  display: flex;
  gap: 16px;
}

.control-button {
  flex: 1;
  height: 50px;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--bg-color, #e0e5ec);
  color: var(--text-secondary, #6e6e73);
  /* Neumorphic Outset Shadow */
  box-shadow: 
    6px 6px 12px var(--shadow-dark, #a3b1c6), 
    -6px -6px 12px var(--shadow-light, #ffffff);
  transition: all 0.1s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-button:hover {
  color: var(--text-primary, #1d1d1f);
  transform: translateY(-1px);
}

.control-button:active {
  transform: translateY(1px);
  box-shadow: 
    inset 2px 2px 5px var(--shadow-dark, #a3b1c6), 
    inset -2px -2px 5px var(--shadow-light, #ffffff);
}

.primary {
  color: var(--accent-color, #007aff);
}

.secondary {
  color: var(--text-secondary, #6e6e73);
}

/* Status & Alerts */
.status-box {
  padding: 16px;
  border-radius: 12px;
  font-size: 0.9rem;
  /* Shallow inset for status area */
  box-shadow: 
    inset 2px 2px 5px var(--shadow-dark, #a3b1c6), 
    inset -2px -2px 5px var(--shadow-light, #ffffff);
}

.status-box strong {
  display: block;
  margin-bottom: 4px;
}

.status-box.error {
  color: #ef4444;
  border-left: 4px solid #ef4444;
}
.status-box.success {
  color: #10b981;
  border-left: 4px solid #10b981;
}
.status-box.warning {
  color: #f59e0b;
  border-left: 4px solid #f59e0b;
}

.invalid-list {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0,0,0,0.05);
  font-size: 0.8rem;
}
.invalid-list ul {
  padding-left: 20px;
  margin: 4px 0 0 0;
}

.popup-helper ol {
  padding-left: 20px;
  margin: 8px 0 0 0;
}
</style>