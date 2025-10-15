<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as duckdb from '@duckdb/duckdb-wasm';

const fileStatus = ref<string>('Initializing DuckDB...');
const rowCount = ref<number | null>(null);
const processedRows = ref<number>(0);
const progressPercent = ref<number>(0);
const fileName = ref<string | null>(null);
const isProcessing = ref<boolean>(false);
const isConverting = ref<boolean>(false);
const db = ref<duckdb.AsyncDuckDB | null>(null);

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
  } catch (error) {
    console.error("Failed to initialize DuckDB:", error);
    fileStatus.value = `Error: ${(error as Error).message}`;
  }
});

const handleFileUpload = async (event: Event) => {
  if (!db.value) return;
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isProcessing.value = true;
  fileStatus.value = `Processing file: ${file.name}...`;
  fileName.value = file.name;
  rowCount.value = null;

  try {
    await db.value.registerFileBuffer(file.name, new Uint8Array(await file.arrayBuffer()));
    const conn = await db.value.connect();
    const countResult = await conn.query(`SELECT COUNT(*) AS cnt FROM read_parquet('${file.name}')`);
    rowCount.value = Number(countResult.toArray()[0].cnt);
    await conn.close();

    fileStatus.value = `File loaded. ${rowCount.value.toLocaleString()} rows ready.`;
  } catch (error) {
    console.error("Failed to process file:", error);
    fileStatus.value = `Error: ${(error as Error).message}`;
  } finally {
    isProcessing.value = false;
  }
};

const handleDownloadCsv = async () => {
  if (!db.value || !fileName.value) return;

  isConverting.value = true;
  fileStatus.value = 'Starting CSV conversion...';
  processedRows.value = 0;
  progressPercent.value = 0;

  const BATCH_SIZE = 20000; // Tune for memory vs speed

  try {
    const conn = await db.value.connect();
    const csvFileName = fileName.value.replace(/\.parquet$/i, '.csv');
    const csvChunks: BlobPart[] = [];

    // --- Header ---
    const schema = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${fileName.value}')`);
    const columns = schema.toArray().map(r => r.column_name);
    csvChunks.push(columns.join(',') + '\n');

    let offset = 0;
    const total = rowCount.value ?? 0;

    // --- Batch loop ---
    while (true) {
      const query = `SELECT * FROM read_parquet('${fileName.value}') LIMIT ${BATCH_SIZE} OFFSET ${offset}`;
      const result = await conn.query(query);
      const rows = result.toArray();
      if (rows.length === 0) break;

      const csvLines = rows.map(row =>
        columns.map(c => {
          const val = row[c];
          if (val === null || val === undefined) return '';
          if (typeof val === 'bigint') return val.toString();
          if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
          return val.toString();
        }).join(',')
      );

      csvChunks.push(csvLines.join('\n') + '\n');

      processedRows.value += rows.length;
      offset += BATCH_SIZE;

      // --- Update progress ---
      if (total > 0) {
        progressPercent.value = Math.min(100, Math.round((processedRows.value / total) * 100));
        fileStatus.value = `Processing ${processedRows.value.toLocaleString()} of ${total.toLocaleString()} rows (${progressPercent.value}%)`;
      } else {
        fileStatus.value = `Processed ${processedRows.value.toLocaleString()} rows...`;
      }

      await new Promise(r => setTimeout(r, 0)); // yield to UI
    }

    await conn.close();

    // --- Final download ---
    const blob = new Blob(csvChunks, { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = csvFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    fileStatus.value = `✅ Done! Exported ${processedRows.value.toLocaleString()} rows.`;
  } catch (error) {
    console.error("Conversion error:", error);
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
    /> --><div v-if="isConverting" class="progress-bar-wrapper">
  <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
</div>

    
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
.progress-bar-wrapper {
  width: 100%;
  height: 14px;
  border-radius: 10px;
  background: #d1d9e6;
  overflow: hidden;
  box-shadow: inset 2px 2px 5px #a3b1c6, inset -2px -2px 5px #ffffff;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  transition: width 0.2s ease;
}

</style>