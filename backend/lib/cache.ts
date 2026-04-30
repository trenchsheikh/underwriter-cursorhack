/**
 * In-memory cache + fixture fallback. Spec: Backend.md §7.
 *
 *   1. Check in-memory cache.
 *   2. On hit, return with `cached: false` (we served from our own RAM,
 *      not from the upstream network).
 *   3. Else try `fetcher()`. On success, store and return.
 *   4. On failure, if `fixturePath` is provided, load it and return with
 *      `cached: true` so the UI labels the citation as cached.
 *   5. If no fixture, throw.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export interface CacheOptions {
  ttlSeconds?: number;
  fixturePath?: string;
  /** Force using the fixture (bypass live fetcher). DEMO_FORCE_FIXTURES=true. */
  forceFixture?: boolean;
}

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: CacheOptions = {},
): Promise<{ value: T; cached: boolean }> {
  const { ttlSeconds = 24 * 60 * 60, fixturePath, forceFixture } = opts;

  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > Date.now()) {
    return { value: hit.value, cached: false };
  }

  if (!forceFixture) {
    try {
      const value = await fetcher();
      store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
      return { value, cached: false };
    } catch (err) {
      if (!fixturePath) throw err;
      // fall through to fixture fallback
    }
  }

  if (!fixturePath) {
    throw new Error(`cache miss and no fixture for key=${key}`);
  }
  const value = await loadFixture<T>(fixturePath);
  return { value, cached: true };
}

export async function loadFixture<T>(relPath: string): Promise<T> {
  const abs = join(/* turbopackIgnore: true */ process.cwd(), relPath);
  const raw = await readFile(abs, "utf8");
  return JSON.parse(raw) as T;
}

export function isForceFixtures(): boolean {
  return (process.env.DEMO_FORCE_FIXTURES ?? "").toLowerCase() === "true";
}
