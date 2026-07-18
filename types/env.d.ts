// Minimal ambient shim so `// @ts-check`'d files can touch Vite's
// import.meta.env without dragging in the full vite/client types.
interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
