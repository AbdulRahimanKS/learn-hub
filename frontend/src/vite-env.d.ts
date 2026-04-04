/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Optional WebSocket origin (ws:// or wss:// + host[:port]). Overrides derivation from VITE_API_BASE_URL. */
  readonly VITE_WS_BASE_URL?: string;
}
