<script setup lang="ts">
import { ref } from 'vue';
// 1. Import the new components
import ParquetConverter from './components/ParquetConverter.vue';
import PomodoroTimer from './components/PomodoroTimer.vue';
import ResumeRectifier from './components/ResumeRectifier.vue';
import BatchLinkOpener from './components/BatchLinkOpener.vue';

// --- STATE ---
const activeTab = ref('parquet');

// 2. Update the tabs array to include new tools
const tabs = [
  { id: 'parquet', name: 'Parquet To CSV Converter' },
  { id: 'pomodoro', name: 'Pomodoro Timer' },
  { id: 'resumerectifier', name: 'Resume Rectifier' },
  { id: 'batchlinkopener', name: 'Bulk Link Opener' },
];
</script>

<template>
  <div class="app-shell">
    <nav class="tabs-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="{ 'active': activeTab === tab.id }"
        @click="activeTab = tab.id"
        class="tab-button"
      >
        {{ tab.name }}
      </button>
    </nav>

    <main class="tab-content">
      
      <ParquetConverter v-if="activeTab === 'parquet'" />
      
      <PomodoroTimer v-if="activeTab === 'pomodoro'" />

      <ResumeRectifier v-if="activeTab === 'resumerectifier'" />
      <BatchLinkOpener v-if="activeTab === 'batchlinkopener'" />
    </main>
  </div>
</template>

<style>
/* --- Global Styles --- */
:root {
  --accent-color: #007aff;
  --background-shell: #e0e5ec; /* This is our main background color */
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --border-color: #d2d2d7;
  --radius: 12px;
}
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: var(--background-shell);
  color: var(--text-primary);
}
#app {
  padding: 2rem;
  box-sizing: border-box;
}

/* --- App Shell & Tab Layout --- */
.app-shell {
  max-width: 1200px;
  margin: 0 auto;
}
.tabs-nav {
  display: flex;
  gap: 10px; /* Add a little space between tabs */
  padding-left: 20px;
}
.tab-button {
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  background-color: #d1d9e6; /* A slightly darker, inactive state */
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  position: relative;
  color: var(--text-secondary);
  transition: all 0.2s ease-in-out;
  box-shadow: 3px 3px 6px #a3b1c6, -3px -3px 6px #ffffff;
}
.tab-button.active {
  /* Active tab has the same background as the body, making it seamless */
  background-color: var(--background-shell);
  color: var(--text-primary);
  /* Use an inset shadow to look "pressed" */
  box-shadow: inset 2px 2px 4px #a3b1c6, inset -2px -2px 4px #ffffff;
}
.tab-content {
  /* Make the content container invisible */
  background-color: transparent;
  border: none;
  /* The ParquetConverter card will provide the visual content area */
  padding-top: 2rem;
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50vh;
  color: var(--text-secondary);
}
</style>