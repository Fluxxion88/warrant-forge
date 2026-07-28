import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/** True inside the Tauri shell; false in a plain browser or a Node test runner. */
export const inTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!inTauri) return Promise.reject(new Error("not running in the desktop shell"));
  return tauriInvoke<T>(cmd, args);
}

export interface ProviderPublic {
  id: string;
  kind: string;
  label: string;
  base_url: string | null;
  has_key: boolean;
  enabled: boolean;
}

export interface Extracted {
  name: string;
  content: string;
  kind: string;
  warning: string | null;
}

export interface Completion {
  text: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
}

export function money(usd: number): string {
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(3)}`;
}

export function compactNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
