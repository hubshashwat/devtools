<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';

// --- State ---
const resumeText = ref<string>('');
const fileName = ref<string | null>(null);
const isProcessing = ref<boolean>(false);
const isDictLoading = ref<boolean>(true);
const spellchecker = ref<any>(null);
const debouncedText = ref<string>('');
const ignoredWords = ref<Set<string>>(new Set()); // User-ignored words

// --- Dictionaries (Rule Engine) ---
const dictionaries = {
  weakVerbs: [
    { word: 'helped', suggestion: 'Facilitated, Assisted, Supported' },
    { word: 'responsible for', suggestion: 'Spearheaded, Managed, Executed' },
    { word: 'worked on', suggestion: 'Developed, Created, Engineered' },
    { word: 'handled', suggestion: 'Resolved, Managed, Controlled' },
    { word: 'tried', suggestion: 'Attempted, Initiated' },
    { word: 'saw', suggestion: 'Observed, Identified' },
    { word: 'did', suggestion: 'Accomplished, Performed' }
  ],
  cliches: [
    'hard worker', 'team player', 'go-getter', 'synergy', 
    'think outside the box', 'results-driven', 'detail-oriented',
    'references available upon request'
  ]
};

// --- Initialization ---
onMounted(async () => {
  if (!document.getElementById('fa-css')) {
    const link = document.createElement('link');
    link.id = 'fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
    document.head.appendChild(link);
  }

  if (!(window as any).pdfjsLib) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    };
    document.head.appendChild(script);
  }

  try {
    const nspellModule = await import('https://esm.sh/nspell');
    const NSpell = nspellModule.default || nspellModule;

    const [aff, dic] = await Promise.all([
      fetch('https://cdn.jsdelivr.net/npm/dictionary-en/index.aff').then(r => r.text()),
      fetch('https://cdn.jsdelivr.net/npm/dictionary-en/index.dic').then(r => r.text())
    ]);

    spellchecker.value = new NSpell(aff, dic);
    isDictLoading.value = false;
  } catch (err) {
    console.error("Failed to load spellchecker:", err);
    isDictLoading.value = false;
  }
});

// --- Debounce Logic ---
let timeout: any;
watch(resumeText, (newVal) => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    debouncedText.value = newVal;
  }, 600); 
});

// --- Actions ---
const ignoreWord = (word: string) => {
  ignoredWords.value.add(word);
  ignoredWords.value = new Set(ignoredWords.value);
};

// --- Computed Analysis ---
const wordCount = computed(() => {
  if (!debouncedText.value) return 0;
  return debouncedText.value.trim().split(/\s+/).length;
});

const weakWordMatches = computed(() => {
  if (!debouncedText.value) return [];
  const matches: { word: string; suggestion: string }[] = [];
  const lowerText = debouncedText.value.toLowerCase();
  
  dictionaries.weakVerbs.forEach(item => {
    const regex = new RegExp(`\\b${item.word}\\b`, 'gi');
    if (regex.test(lowerText)) {
      matches.push(item);
    }
  });
  return matches;
});

const clicheMatches = computed(() => {
  if (!debouncedText.value) return [];
  const matches: string[] = [];
  const lowerText = debouncedText.value.toLowerCase();
  
  dictionaries.cliches.forEach(phrase => {
    if (lowerText.includes(phrase)) {
      matches.push(phrase);
    }
  });
  return matches;
});

// --- Advanced Spell Checker ---
const spellingMatches = computed(() => {
  if (!debouncedText.value || !spellchecker.value) return [];

  let cleanText = debouncedText.value
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ') 
    .replace(/https?:\/\/[^\s]+/g, ' ');

  const words = cleanText.match(/\b[a-zA-Z']+\b/g) || [];
  const errors = new Set<string>();
  const results: { error: string; correction: string }[] = [];

  // 1. Manual Correction Map
  const manualCorrections: Record<string, string> = {
    'upto': 'up to',
    'teh': 'the',
    'im': "I'm",
    'dont': "don't",
    'cant': "can't"
  };

  // 2. Extended Tech & Scientific Whitelist
  const whitelist = new Set([
    'gmail', 'outlook', 'yahoo', 'hotmail', 'linkedin', 'github', 'gitlab', 'bitbucket',
    'javascript', 'typescript', 'react', 'vue', 'angular', 'html', 'css', 'scss', 'json', 'xml',
    'python', 'java', 'c++', 'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'ci/cd', 'devops',
    'jira', 'trello', 'asana', 'slack', 'zoom', 'skype', 'figma', 'adobe', 'photoshop',
    'api', 'rest', 'graphql', 'jwt', 'oauth', 'saas', 'paas', 'iaas',
    'nanoparticles', 'bioinformatics', 'genomics', 'iot', 'ai', 'ml', 'nlp',
    'frontend', 'backend', 'fullstack', 'agile', 'scrum', 'kanban', 'sdlc',
    'vivo', 'vitro', 'situ', 'silico', 'et', 'al'
  ]);

  words.forEach(word => {
    const originalWord = word;
    
    // Basic Filters
    if (word.length < 4 && !manualCorrections[word.toLowerCase()]) return; 
    if (word === word.toUpperCase()) return;
    if (/^[A-Z]/.test(word)) return; // Ignore Names
    if (ignoredWords.value.has(word)) return; // User ignored words

    const lower = word.toLowerCase();
    
    // Check Manual Corrections first
    if (manualCorrections[lower]) {
      if (!errors.has(word)) {
        errors.add(word);
        results.push({ error: originalWord, correction: manualCorrections[lower] });
      }
      return;
    }

    if (whitelist.has(lower)) return;

    // Spell Check
    if (!spellchecker.value.correct(word)) {
      if (!errors.has(word)) {
        errors.add(word);
        const suggestions = spellchecker.value.suggest(word);
        
        if (suggestions.length === 0) return;

        results.push({
          error: originalWord,
          correction: suggestions[0]
        });
      }
    }
  });

  return results.slice(0, 10);
});

// --- Scoring ---
const score = computed(() => {
  if (debouncedText.value.length < 50) return 0;
  
  let baseScore = 100;
  baseScore -= (weakWordMatches.value.length * 5);
  baseScore -= (clicheMatches.value.length * 7);
  baseScore -= (spellingMatches.value.length * 5);

  if (wordCount.value < 200) baseScore -= 10;
  if (wordCount.value > 1000) baseScore -= 5;

  return Math.max(0, Math.min(100, baseScore));
});

const scoreLabel = computed(() => {
  const s = score.value;
  if (s >= 90) return 'Excellent';
  if (s >= 75) return 'Good';
  if (s >= 50) return 'Needs Work';
  return 'Critical';
});

const scoreColor = computed(() => {
  const s = score.value;
  if (s >= 90) return 'var(--success-color)';
  if (s >= 75) return 'var(--accent-color)';
  if (s >= 50) return 'var(--warning-color)';
  return 'var(--danger-color)';
});

const scoreMessage = computed(() => {
  const s = score.value;
  if (s >= 90) return "Your resume is polished, typo-free, and impactful.";
  if (s >= 75) return "Good job, but check for minor typos and weak verbs.";
  if (s >= 50) return "Found some spelling errors or passive language.";
  return "Needs immediate attention: spelling errors or weak content detected.";
});

// --- Handlers ---
const clearData = () => {
  resumeText.value = '';
  debouncedText.value = '';
  fileName.value = '';
  ignoredWords.value.clear();
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!(window as any).pdfjsLib) {
    alert("PDF Analyzer is still initializing... please wait 2 seconds and try again.");
    return;
  }

  isProcessing.value = true;
  fileName.value = file.name;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    resumeText.value = fullText;
    debouncedText.value = fullText;
  } catch (error) {
    console.error("PDF Error:", error);
    alert("Could not read PDF. Please paste text manually.");
  } finally {
    isProcessing.value = false;
  }
};
</script>

<template>
  <div class="app-container">
    
    <!-- Header -->
    <header class="neu-card">
      <h1>Resume Rectifier</h1>
      <p class="subtitle">Offline, Privacy-First, Base-level Resume Checking</p>
    </header>

    <!-- Input Section -->
    <section class="neu-card">
      <div class="action-row">
        <label class="neu-btn">
          <i class="fa-solid fa-file-pdf"></i>
          {{ fileName || 'Upload PDF Resume' }}
          <input type="file" @change="handleFileUpload" accept=".pdf" :disabled="isProcessing">
        </label>
        <button class="neu-btn" @click="clearData" v-if="resumeText">
          <i class="fa-solid fa-trash"></i> Clear
        </button>
      </div>

      <!-- Enhanced Neumorphic Loader -->
      <div v-if="isProcessing || isDictLoading" class="loader-section">
        <div class="neu-progress-track">
          <div class="neu-progress-bar indeterminate"></div>
        </div>
        <div class="loading-status">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <span>{{ isDictLoading ? 'Initializing Dictionary Engine...' : 'Scanning PDF...' }}</span>
        </div>
      </div>

      <textarea 
        v-model="resumeText" 
        class="neu-input" 
        spellcheck="false"
        placeholder="Or paste your resume text here to begin analysis..."
      ></textarea>
      
      <div class="meta-row">
        {{ wordCount }} words detected
      </div>
    </section>

    <!-- Analysis Section -->
    <transition name="fade">
      <section v-if="debouncedText.length > 50" class="results-grid">
        
        <!-- Overall Score -->
        <div class="neu-card score-display">
          <h2>Audit Score</h2>
          <div class="score-circle">
            <span class="score-number" :style="{ color: scoreColor }">{{ score }}</span>
            <span class="score-label" :style="{ color: scoreColor }">{{ scoreLabel }}</span>
          </div>
          <p class="score-msg">
            {{ scoreMessage }}
          </p>
        </div>

        <!-- Spelling & Typos -->
        <div class="neu-card">
          <h2><i class="fa-solid fa-spell-check text-danger"></i> Spelling Check</h2>
          <div v-if="isDictLoading">
            <p class="sub-text">Initialize dictionary engine...</p>
          </div>
          <div v-else-if="spellingMatches.length === 0" class="list-item">
            <i class="fa-solid fa-check-circle text-success"></i>
            <span>No common spelling errors found.</span>
          </div>
          <div v-else>
            <div v-for="(match, index) in spellingMatches" :key="index" class="list-item space-between">
              <div class="flex items-start">
                <i class="fa-solid fa-eraser text-danger mt-1"></i>
                <div>
                  Found: "<strong>{{ match.error }}</strong>" <br>
                  <span class="sub-text" v-if="match.correction">Did you mean: <strong>{{ match.correction }}</strong>?</span>
                </div>
              </div>
              <button class="ignore-btn" @click="ignoreWord(match.error)" title="Ignore this word">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
            <div v-if="spellingMatches.length >= 10" class="more-indicator">
              (Showing first 10 errors)
            </div>
          </div>
        </div>

        <!-- Weak Words -->
        <div class="neu-card">
          <h2><i class="fa-solid fa-triangle-exclamation text-warning"></i> Weak Verbs</h2>
          <div v-if="weakWordMatches.length === 0" class="list-item">
            <i class="fa-solid fa-check-circle text-success"></i>
            <span>No weak passive verbs found.</span>
          </div>
          <div v-else>
            <div v-for="(match, index) in weakWordMatches.slice(0, 5)" :key="index" class="list-item">
              <i class="fa-solid fa-xmark text-warning"></i>
              <span>
                Used "<strong>{{ match.word }}</strong>". <br>
                <span class="sub-text">Try: <em>{{ match.suggestion }}</em></span>
              </span>
            </div>
            <div v-if="weakWordMatches.length > 5" class="more-indicator">
              + {{ weakWordMatches.length - 5 }} more
            </div>
          </div>
        </div>

        <!-- Clichés -->
        <div class="neu-card">
          <h2><i class="fa-solid fa-ban text-warning"></i> Clichés</h2>
          <div v-if="clicheMatches.length === 0" class="list-item">
            <i class="fa-solid fa-check-circle text-success"></i>
            <span>Clean! No overused buzzwords.</span>
          </div>
          <div v-else>
            <div v-for="(word, index) in clicheMatches" :key="index" class="list-item">
              <i class="fa-solid fa-bomb text-warning"></i>
              <span>Remove "<strong>{{ word }}</strong>". Be specific instead.</span>
            </div>
          </div>
        </div>

      </section>
    </transition>
  </div>
</template>

<style scoped>
/* Variables mapped to standard CSS variables or values */
.app-container {
  --bg-color: #e0e5ec;
  --primary-color: #1d1e20;
  --accent-color: #4a90e2;
  --text-color: #2c3e50;
  --shadow-light: #ffffff;
  --shadow-dark: #a3b1c6;
  --danger-color: #e74c3c;
  --success-color: #2ecc71;
  --warning-color: #f1c40f;
  
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 30px;
  padding: 20px;
  color: var(--text-color);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* Neumorphic Cards */
.neu-card {
  padding: 2rem;
  border-radius: 20px;
  background: var(--bg-color);
  box-shadow: 9px 9px 16px var(--shadow-dark), -9px -9px 16px var(--shadow-light);
}

/* Typography */
h1 {
  color: var(--primary-color);
  margin: 0 0 10px 0;
  font-weight: 700;
  text-align: center;
}

h2 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  gap: 10px;
}

.subtitle {
  text-align: center;
  color: #6b7c93;
  margin: 0;
  font-size: 0.95rem;
}

/* Textarea */
.neu-input {
  width: 100%;
  padding: 15px;
  border-radius: 15px;
  border: none;
  background: var(--bg-color);
  box-shadow: inset 5px 5px 10px var(--shadow-dark), inset -5px -5px 10px var(--shadow-light);
  color: var(--text-color);
  font-family: inherit;
  font-size: 0.9rem;
  resize: vertical;
  min-height: 200px;
  outline: none;
  box-sizing: border-box;
  transition: box-shadow 0.2s;
  margin-top: 20px;
}
.neu-input:focus {
  box-shadow: inset 2px 2px 5px var(--shadow-dark), inset -2px -2px 5px var(--shadow-light);
}

/* Buttons & Upload */
.action-row {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
}

.neu-btn {
  padding: 12px 30px;
  border-radius: 50px;
  border: none;
  background: var(--bg-color);
  color: var(--primary-color);
  font-weight: 600;
  cursor: pointer;
  box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.neu-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
  color: var(--accent-color);
}

.neu-btn:active:not(:disabled) {
  box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
  transform: translateY(0);
}

.neu-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

input[type="file"] {
  display: none;
}

/* Analysis Results */
.results-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 768px) {
  .results-grid {
    grid-template-columns: 1fr;
  }
}

.score-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--bg-color);
  box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
  position: relative;
}

.score-circle::before {
  content: '';
  position: absolute;
  width: 85%;
  height: 85%;
  border-radius: 50%;
  box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
}

.score-number {
  font-size: 2.5rem;
  font-weight: 800;
  z-index: 1;
  color: var(--primary-color);
}

.score-label {
  font-size: 0.9rem;
  font-weight: 600;
  z-index: 1;
}

.score-msg {
  text-align: center;
  font-size: 0.9rem;
  padding: 0 10px;
}

.list-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  margin-bottom: 10px;
  border-radius: 12px;
  background: var(--bg-color);
  box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
}

.list-item.space-between {
    justify-content: space-between;
    align-items: center;
}

.list-item i {
  margin-right: 12px;
}

.ignore-btn {
    background: transparent;
    border: none;
    color: #999;
    cursor: pointer;
    padding: 5px;
    transition: color 0.2s;
}

.ignore-btn:hover {
    color: var(--danger-color);
}

.text-danger { color: var(--danger-color); }
.text-warning { color: var(--warning-color); }
.text-success { color: var(--success-color); }

.meta-row {
  text-align: right; 
  margin-top: 10px; 
  font-size: 0.8rem; 
  color: #666;
}

.sub-text {
  font-size: 0.85rem; 
  color: #666;
}

.more-indicator {
  text-align: center; 
  font-size: 0.8rem; 
  margin-top: 5px;
}

.hint {
  font-size: 0.8rem; 
  margin-top: 10px; 
  opacity: 0.7;
}

/* ENHANCED LOADER STYLES */
.loader-section {
  margin-top: 20px;
  text-align: center;
}

.neu-progress-track {
  width: 100%;
  height: 12px;
  background: var(--bg-color);
  border-radius: 20px;
  box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
  overflow: hidden;
  position: relative;
}

.neu-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--success-color), var(--warning-color));
  border-radius: 20px;
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
  width: 0%;
  transition: width 0.3s ease;
}

.neu-progress-bar.indeterminate {
  width: 50% !important;
  animation: slide 1.5s infinite ease-in-out;
  background: linear-gradient(90deg, var(--accent-color), #6dd5ed);
}

@keyframes slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}

.loading-status {
  margin-top: 12px;
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.loading-status i {
  color: var(--accent-color);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>