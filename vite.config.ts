import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
// Corrected import: Remove the curly braces {}
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation';

// REPLACE 'your-repo-name' WITH THE NAME OF YOUR GITHUB REPOSITORY
const repoName = 'devtools'; // Example based on your file path

export default defineConfig({
  base: `/${repoName}/`, // This is crucial for GitHub Pages
  plugins: [
    vue(),
    crossOriginIsolation(), // This adds the necessary headers
  ],
});