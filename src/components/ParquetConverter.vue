<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as duckdb from '@duckdb/duckdb-wasm';

// --- STATE ---
const fileStatus = ref<string>('Initializing DuckDB...');
const rowCount = ref<number | null>(null);
const fileName = ref<string | null>(null); // To store the uploaded file's name
const isProcessing = ref<boolean>(false);
const isConverting = ref<boolean>(false); // For the download button state
const db = ref<duckdb.AsyncDuckDB | null>(null);

// --- INITIALIZATION ---
onMounted(async () => {
  try {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
    );
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    const newDb = new duckdb.AsyncDuckDB(logger, worker);
    await newDb.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);
    db.value = newDb;
    fileStatus.value = 'Ready. Please select a Parquet file.';
    console.log("✅ DuckDB Initialized");
  } catch (error) {
    console.error("Failed to initialize DuckDB:", error);
    fileStatus.value = `Error: ${(error as Error).message}`;
  }
});

// --- METHODS ---
const handleFileUpload = async (event: Event) => {
  if (!db.value) { return; }
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) { return; }

  isProcessing.value = true;
  fileStatus.value = `Processing file: ${file.name}...`;
  rowCount.value = null;
  fileName.value = file.name; // Store the filename

  try {
    await db.value.registerFileBuffer(file.name, new Uint8Array(await file.arrayBuffer()));
    const conn = await db.value.connect();
    
    const countResult = await conn.query(`SELECT COUNT(*) FROM '${file.name}'`);
    rowCount.value = countResult.toArray()[0]['count_star()'] as number;
    
    await conn.close();
    fileStatus.value = `File loaded. Ready to download.`;
  } catch (error) {
    console.error("Failed to process Parquet file:", error);
    fileStatus.value = `Error: ${(error as Error).message}`;
  } finally {
    isProcessing.value = false;
  }
};

const handleDownloadCsv = async () => {
  if (!db.value || !fileName.value) { return; }

  isConverting.value = true;
  fileStatus.value = 'Converting to CSV... this may take a moment for large files.';
  const csvFileName = 'export.csv';
  
  try {
    const conn = await db.value.connect();
    
    // --- THIS IS THE FIX ---
    // Increase the memory limit for this connection to handle the large file.
    await conn.query("PRAGMA memory_limit='1GB';");
    // --- END OF FIX ---

    // Use the COPY command to export the entire table to a virtual file
    await conn.query(`COPY (SELECT * FROM '${fileName.value}') TO '${csvFileName}' WITH (FORMAT CSV, HEADER);`);
    
    await conn.close();

    // Read the virtual file from DuckDB's memory into a buffer
    const buffer = await db.value.copyFileToBuffer(csvFileName);
    
    // Trigger the download using the buffer
    const blob = new Blob([buffer], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const downloadFileName = fileName.value.replace(/\.parquet$/i, '.csv');
    link.setAttribute('download', downloadFileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    fileStatus.value = 'CSV download initiated.';
  } catch (error) {
    console.error("Failed to convert to CSV:", error);
    fileStatus.value = `Error: ${(error as Error).message}`;
  } finally {
    isConverting.value = false;
  }
};
</script>

<template>
  <main class="container">
    <header>
      <h1>Parquet to CSV Converter</h1>
      <p>On The Fly, On the UI [Privacy-Focused]</p>
    </header>

    <div class="upload-wrapper">
<label for="file-upload" class="upload-label">
  {{ fileName  || 'Upload Parquet' }}
</label>
  <input 
    id="file-upload" 
    type="file" 
    class="file-input" 
    @change="handleFileUpload" 
    :disabled="isProcessing || !db" 
    accept=".parquet" 
  />
</div>

    
    <!-- <input 
      type="file" 
      @change="handleFileUpload" 
      :disabled="isProcessing || !db" 
      accept=".parquet" 
      class="file-input"
    /> -->
    
    <div class="status-box">
      <strong>Status:</strong> {{ fileStatus }}
    </div>
    
    <div v-if="rowCount !== null" class="info-box">
      <strong>Row Count:</strong> {{ rowCount.toLocaleString() }}
    </div>

    <div v-if="rowCount !== null" class="download-container">
      <button @click="handleDownloadCsv" :disabled="isConverting" class="download-button">
        {{ isConverting ? 'Converting...' : 'Download as CSV' }}
      </button>
    </div>
    
  </main>
</template>


<style>
:root {
  --bg-color: #e0e5ec; /* base background */
  --primary-color: #1d1e20e0;
  --text-color: #2c3e50;
  --shadow-light: #ffffff;
  --shadow-dark: #a3b1c6;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg-color);
  color: var(--text-color);
}

/* Container */
.container {
  max-width: 800px;
  margin: 40px auto;
  padding: 2rem;
  border-radius: 20px;
  background: var(--bg-color);
  box-shadow: 
    9px 9px 16px var(--shadow-dark),
    -9px -9px 16px var(--shadow-light);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Header */
header {
  text-align: center;
  padding-bottom: 20px;
}
header h1 {
  color: var(--primary-color);
  margin: 0;
  font-weight: 600;
  font-size: 1.8rem;
}

/* Hide the default input */
.file-input {
  display: none;
}

/* Upload button container (like the circle + pill combo) */
.upload-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

/* Round circle button with arrow */
.upload-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--bg-color);
  box-shadow: 
    6px 6px 12px var(--shadow-dark),
    -6px -6px 12px var(--shadow-light);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}
.upload-circle:hover {
  transform: translateY(-2px);
  box-shadow: 
    3px 3px 6px var(--shadow-dark),
    -3px -3px 6px var(--shadow-light);
}
.upload-circle span {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--text-color);
}

/* Label styled as pill */
.upload-label {
  padding: 15px 30px;
  border-radius: 40px;
  background: var(--bg-color);
  box-shadow: 
    6px 6px 12px var(--shadow-dark),
    -6px -6px 12px var(--shadow-light);
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  font-weight: bold;
  color: var(--text-color);
}
.upload-label:hover {
  transform: translateY(-2px);
  box-shadow: 
    3px 3px 6px var(--shadow-dark),
    -3px -3px 6px var(--shadow-light);
}

/* Status & Info */
.status-box, .info-box {
  border-radius: 12px;
  padding: 15px;
  background: var(--bg-color);
  box-shadow: 
    inset 2px 2px 5px var(--shadow-dark),
    inset -2px -2px 5px var(--shadow-light);
}

/* Download Button */
.download-container {
  text-align: center;
}
.download-button {
  background: var(--bg-color);
  color: var(--text-color);
  border: none;
  padding: 15px 40px;
  font-size: 1.1rem;
  font-weight: bold;
  border-radius: 50px;
  cursor: pointer;
  box-shadow: 
    6px 6px 12px var(--shadow-dark),
    -6px -6px 12px var(--shadow-light);
  transition: all 0.2s ease-in-out;
}
.download-button:hover {
  transform: translateY(-2px);
  box-shadow: 
    3px 3px 6px var(--shadow-dark),
    -3px -3px 6px var(--shadow-light);
}
.download-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: 
    inset 2px 2px 4px var(--shadow-dark),
    inset -2px -2px 4px var(--shadow-light);
}
</style>
