import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";

const CACHE_KEY = "gcp_3d_session";
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

// The upstream d.ts only declares the constructor. Augment with runtime members.
declare module "3d-tiles-renderer/plugins" {
  interface GoogleCloudAuthPlugin {
    auth: { sessionToken: string | null };
    fetchData(uri: string, options: RequestInit): Promise<unknown>;
  }
}

/**
 * Extends GoogleCloudAuthPlugin with localStorage session caching.
 * Google bills per root.json request ($6/1k). Without caching, every
 * page refresh / HMR / tab switch creates a new session. This plugin
 * caches the root tileset JSON + session token for 3 hours.
 */
export class CachedGoogleCloudAuthPlugin extends GoogleCloudAuthPlugin {
  async fetchData(uri: string, options: RequestInit) {
    const { auth } = this;

    // On the first fetch (root.json), check localStorage for a cached session
    if (auth.sessionToken === null) {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        try {
          const cached = JSON.parse(raw);
          if (Date.now() - cached.timestamp < THREE_HOURS_MS) {
            auth.sessionToken = cached.sessionToken;
            console.log("Georacr: Reusing cached 3D session.");
            return cached.rootJson;
          }
        } catch {
          // Corrupt cache, fall through to fresh fetch
        }
        localStorage.removeItem(CACHE_KEY);
      }
    }

    // Track whether this fetch will be the root request
    const isRootFetch = auth.sessionToken === null;

    const result = await super.fetchData(uri, options);

    // After the root fetch, cache the response JSON + session token
    if (isRootFetch && auth.sessionToken !== null) {
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            rootJson: result,
            sessionToken: auth.sessionToken,
            timestamp: Date.now(),
          }),
        );
      } catch {
        // localStorage full or unavailable — not critical
      }
      console.log("Georacr: Initialized new 3D session.");
    }

    return result;
  }
}
