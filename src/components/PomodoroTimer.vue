<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';

// --- STATE ---
const time = ref(25 * 60); // Time in seconds
const timerId = ref<number | null>(null);
const isRunning = ref(false);
const mode = ref('work'); // 'work', 'shortBreak', 'longBreak'

const settings = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

// --- COMPUTED PROPERTIES ---
// Formats the time for display (e.g., 25:00)
const formattedTime = computed(() => {
  const minutes = Math.floor(time.value / 60);
  const seconds = time.value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});

// --- METHODS ---
const startTimer = () => {
  if (isRunning.value) return;
  isRunning.value = true;
  timerId.value = window.setInterval(() => {
    if (time.value > 0) {
      time.value--;
    } else {
      pauseTimer();
      // Optional: Add a sound notification here
      alert('Time is up!');
    }
  }, 1000);
};

const pauseTimer = () => {
  if (timerId.value) {
    clearInterval(timerId.value);
    timerId.value = null;
  }
  isRunning.value = false;
};

const resetTimer = () => {
  pauseTimer();
  time.value = settings[mode.value as keyof typeof settings];
};

const switchMode = (newMode: string) => {
  mode.value = newMode;
  resetTimer();
};

// --- LIFECYCLE HOOK ---
// Clean up the timer when the component is removed
onUnmounted(() => {
  pauseTimer();
});
</script>

<template>
  <div class="timer-card">
    <div class="mode-switcher">
      <button @click="switchMode('work')" :class="{ active: mode === 'work' }">Pomodoro</button>
      <button @click="switchMode('shortBreak')" :class="{ active: mode === 'shortBreak' }">Short Break</button>
      <button @click="switchMode('longBreak')" :class="{ active: mode === 'longBreak' }">Long Break</button>
    </div>
    <div class="timer-display">
      <h1>{{ formattedTime }}</h1>
    </div>
    <div class="controls">
      <button v-if="!isRunning" @click="startTimer" class="control-button start">Start</button>
      <button v-else @click="pauseTimer" class="control-button pause">Pause</button>
      <button @click="resetTimer" class="control-button reset">Reset</button>
    </div>
  </div>
</template>

<style scoped>
/* Neumorphic styles using variables from the user's design */
.timer-card {
  max-width: 450px;
  margin: 2rem auto;
  padding: 32px;
  border-radius: 20px;
  background: var(--bg-color, #e0e5ec);
  box-shadow: 
    9px 9px 16px var(--shadow-dark, #a3b1c6),
    -9px -9px 16px var(--shadow-light, #ffffff);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

/* Mode switcher styled as an inset, segmented control */
.mode-switcher {
  display: flex;
  border-radius: 12px;
  padding: 5px;
  background: var(--bg-color, #e0e5ec);
  box-shadow: 
    inset 2px 2px 5px var(--shadow-dark, #a3b1c6),
    inset -2px -2px 5px var(--shadow-light, #ffffff);
}
.mode-switcher button {
  padding: 8px 16px;
  border: none;
  background-color: transparent;
  color: var(--text-secondary, #6e6e73);
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease-in-out;
}
.mode-switcher button.active {
  color: var(--accent-color, #007aff);
  background: var(--bg-color, #e0e5ec);
  box-shadow: 
    3px 3px 6px var(--shadow-dark, #a3b1c6),
    -3px -3px 6px var(--shadow-light, #ffffff);
}

/* Timer display with a subtle text shadow */
.timer-display h1 {
  font-size: 6rem;
  font-weight: 600;
  margin: 16px 0;
  color: var(--text-primary, #1d1d1f);
  text-align: center;
  font-variant-numeric: tabular-nums;
  text-shadow: 1px 1px 2px var(--shadow-light, #ffffff);
}

/* Controls styled as neumorphic buttons */
.controls {
  display: flex;
  gap: 24px;
}
.control-button {
  width: 100px;
  height: 50px;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--bg-color, #e0e5ec);
  color: var(--text-secondary, #6e6e73);
  box-shadow: 
    6px 6px 12px var(--shadow-dark, #a3b1c6),
    -6px -6px 12px var(--shadow-light, #ffffff);
  transition: all 0.1s ease-in-out;
}
.control-button:hover {
  color: var(--text-primary, #1d1d1f);
}
.control-button:active {
  box-shadow: 
    inset 2px 2px 5px var(--shadow-dark, #a3b1c6),
    inset -2px -2px 5px var(--shadow-light, #ffffff);
}
.start {
  color: #34c759; /* Green for Start */
}
.pause {
  color: #ff9500; /* Orange for Pause */
}

@media (max-width: 480px) {
  .timer-card {
    padding: 20px;
    margin: 1rem;
  }
  
  .timer-display h1 {
    font-size: 4rem;
  }

  .controls {
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .control-button {
    width: 80px;
    font-size: 0.9rem;
  }
  
  .mode-switcher {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .mode-switcher button {
    font-size: 0.9rem;
    padding: 6px 12px;
  }
}
</style>