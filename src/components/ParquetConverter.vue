<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as duckdb from '@duckdb/duckdb-wasm';

// --- STATE ---
const fileStatus = ref<string>('Initializing DuckDB...');
const rowCount = ref<number | null>(null);
const fileName = ref<string | null>(null);
const isProcessing = ref<boolean>(false);
const isConverting = ref<boolean>(false);
const db = ref<duckdb.AsyncDuckDB | null>(null);
const uploadProgress = ref<number | null>(null); // For the progress bar

// --- INITIALIZATION ---
onMounted(async () => {
  // This section is correct and remains unchanged
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
// FILE UPLOAD WITH PROGRESS BAR
const handleFileUpload = async (event: Event) => {
  if (!db.value) { return; }
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) { return; }

  isProcessing.value = true;
  fileStatus.value = `Processing file: ${file.name}...`;
  rowCount.value = null;
  fileName.value = file.name;
  uploadProgress.value = 0;

  try {
    // Register the file buffer with a progress callback
    await db.value.registerFileBuffer(
      file.name, 
      new Uint8Array(await file.arrayBuffer()),
      false,
      (progress) => {
        uploadProgress.value = progress.progress * 100;
        fileStatus.value = `Processing file: ${Math.round(uploadProgress.value)}%`;
      }
    );
    
    uploadProgress.value = null; // Hide progress bar after processing
    const conn = await db.value.connect();
    
    const countResult = await conn.query(`SELECT COUNT(*) FROM '${file.name}'`);
    rowCount.value = countResult.toArray()[0]['count_star()'] as number;
    
    await conn.close();
    fileStatus.value = `File loaded. Ready to download.`;
  } catch (error) {
    console.error("Failed to process Parquet file:", error);
    fileStatus.value = `Error: ${(error as Error).message}`;
    uploadProgress.value = null;
  } finally {
    isProcessing.value = false;
  }
};

// Helper function to safely format a cell for CSV
const escapeCsvCell = (cell: any): string => {
  if (cell === null || cell === undefined) {
    return '';
  }
  const str = String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// DOWNLOAD FUNCTION WITH STREAMING (FOR LARGE FILES)
const handleDownloadCsv = async () => {
  if (!db.value || !fileName.value) { return; }

  isConverting.value = true;
  fileStatus.value = 'Streaming conversion to CSV... this may take a moment.';
  
  try {
    const conn = await db.value.connect();
    await conn.query("PRAGMA memory_limit='2GB';");

    // Use conn.send() to get a stream of results
    const reader = await conn.send(`SELECT * FROM '${fileName.value}'`);

    const csvChunks: string[] = [];
    
    // Create the header row from the schema
    const header = reader.schema.fields.map(field => escapeCsvCell(field.name)).join(',');
    csvChunks.push(header);

    // Process the data in batches as it streams in
    for await (const batch of reader) {
      for (const row of batch) {
        const rowValues = Array.from(row).map(cell => escapeCsvCell(cell));
        csvChunks.push(rowValues.join(','));
      }
    }
    
    await conn.close();

    const csvContent = csvChunks.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Trigger the download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const downloadFileName = fileName.value.replace(/\.parquet$/i, '.csv');
    link.setAttribute('download', downloadFileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

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

<div v-if="uploadProgress !== null" class="progress-wrapper">
  <div class="progress-bar-container">
    <div class="progress-bar-fill" :style="{ width: `${uploadProgress}%` }"></div>
  </div>
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
/* Progress Bar */
.progress-wrapper {
  padding: 5px 0;
}
.progress-bar-container {
  height: 10px;
  border-radius: 5px;
  background: var(--bg-color);
  box-shadow: 
    inset 2px 2px 5px var(--shadow-dark),
    inset -2px -2px 5px var(--shadow-light);
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: var(--primary-color);
  border-radius: 5px;
  transition: width 0.2s ease-out;
}

</style>
