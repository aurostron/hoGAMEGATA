const DB_NAME = 'GamegataCatalogDB_v1';
const STORE_NAME = 'catalog';
const MODE_KEY = 'gamegata_catalog_mode';

const CDN_SOURCES = [
  'https://cdn.jsdelivr.net/gh/project-hgg/project-hgg.github.io@main/docs/public',
  'https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/main/docs/public',
  '/catalog',
];

type CatalogMode = 'local' | 'cloud';

export function getCatalogMode(): CatalogMode {
  if (typeof window === 'undefined') return 'local';
  const mode = localStorage.getItem(MODE_KEY);
  return mode === 'cloud' ? 'cloud' : 'local';
}

export function setCatalogMode(mode: CatalogMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent('gamegata_catalog_mode_changed', { detail: { mode } }));
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'));
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getFromDB<T>(key: string): Promise<T | null> {
  return openDB().then((db) => {
    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }).catch(() => null);
}

function setToDB(key: string, value: any): Promise<void> {
  return openDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }).catch(err => {
    console.error('IndexedDB write failed (possible private mode restriction):', err);
  });
}

export async function isCatalogCached(): Promise<{ cached: boolean; count: number; version: string | null }> {
  try {
    const meta = await getFromDB<{ version: string; count: number; savedAt: number }>('meta');
    if (meta) {
      return { cached: true, count: meta.count, version: meta.version };
    }
  } catch (e) {
    // Fail silently on read errors
  }
  return { cached: false, count: 0, version: null };
}

export async function loadCatalogFromDB(): Promise<any[] | null> {
  try {
    const records = await getFromDB<any[]>('records');
    return records || null;
  } catch (e) {
    return null;
  }
}

export async function clearCatalogCache(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to clear catalog cache:', e);
  }
}

async function fetchFromSources(filename: string): Promise<Response> {
  for (const base of CDN_SOURCES) {
    try {
      const res = await fetch(`${base}/${filename}`);
      if (res.ok) return res;
    } catch {
      // Try next CDN source
    }
  }
  throw new Error(`Failed to fetch ${filename} from all CDN sources`);
}

export async function checkForUpdate(): Promise<{ available: boolean; remoteVersion: string | null }> {
  try {
    const res = await fetchFromSources('catalog-manifest.json');
    if (!res.ok) return { available: false, remoteVersion: null };
    
    const manifest = await res.json();
    const cached = await isCatalogCached();
    
    if (!cached.cached || cached.version !== manifest.version) {
      return { available: true, remoteVersion: manifest.version };
    }
  } catch (e) {
    console.error('Update check failed:', e);
  }
  return { available: false, remoteVersion: null };
}

export async function syncCatalog(
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; count: number }> {
  try {
    if (onProgress) onProgress(0);

    // 1. Fetch manifest
    const manifestRes = await fetchFromSources('catalog-manifest.json');
    const manifest = await manifestRes.json();
    const expectedCompressedBytes = manifest.compressedBytes || 7300000;

    if (onProgress) onProgress(5);

    // 2. Stream download catalog-dump.json.gz
    const dumpRes = await fetchFromSources('catalog-dump.json.gz');
    if (!dumpRes.ok) throw new Error('Failed to fetch catalog dump');

    const contentLength = dumpRes.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : expectedCompressedBytes;

    let receivedBytes = 0;
    const chunksData: Uint8Array[] = [];

    if (dumpRes.body) {
      const reader = dumpRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunksData.push(value);
          receivedBytes += value.length;
          // Progress: 5% to 80% during network download
          if (onProgress) {
            const pct = Math.min(80, Math.round(5 + (receivedBytes / totalBytes) * 75));
            onProgress(pct);
          }
        }
      }
    } else {
      const ab = await dumpRes.arrayBuffer();
      chunksData.push(new Uint8Array(ab));
      if (onProgress) onProgress(80);
    }

    if (onProgress) onProgress(85);

    // 3. Decompress in-memory with DecompressionStream
    const compressedBlob = new Blob(chunksData, { type: 'application/gzip' });
    let jsonString: string;

    if (typeof DecompressionStream !== 'undefined') {
      const decompressedStream = compressedBlob.stream().pipeThrough(new DecompressionStream('gzip'));
      jsonString = await new Response(decompressedStream).text();
    } else {
      throw new Error('DecompressionStream is not supported in this browser environment');
    }

    if (onProgress) onProgress(95);

    const allRecords = JSON.parse(jsonString);

    // 4. Save to IndexedDB
    await setToDB('records', allRecords);
    await setToDB('meta', {
      version: manifest.version,
      count: allRecords.length,
      savedAt: Date.now()
    });

    if (onProgress) onProgress(100);

    // 5. If Web Worker is initialized, load records into worker memory
    if (workerInstance) {
      workerInstance.postMessage({ type: 'LOAD_CATALOG', payload: allRecords, id: 'sync' });
    }

    return { success: true, count: allRecords.length };
  } catch (e) {
    console.error('Catalog sync failed:', e);
    return { success: false, count: 0 };
  }
}

// --- Web Worker Orchestration ---

export interface LocalQueryParams {
  search?: string;
  sort?: string;
  genres?: string[];
  systems?: string[];
  decades?: string[];
  features?: string[];
  hideDlcs?: boolean;
  freeOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  offset?: number;
  limit?: number;
}

let workerInstance: Worker | null = null;
let isWorkerReady = false;
let workerInitPromise: Promise<boolean> | null = null;
const pendingQueries = new Map<string, (result: any) => void>();

export function isLocalWorkerReady(): boolean {
  return isWorkerReady;
}

export async function initCatalogWorker(
  onProgress?: (percent: number) => void
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isWorkerReady) return true;
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = (async () => {
    try {
      let records = await loadCatalogFromDB();
      if (!records || records.length === 0) {
        const syncResult = await syncCatalog(onProgress);
        if (!syncResult.success) return false;
        records = await loadCatalogFromDB();
      }

      if (!records || records.length === 0) return false;

      if (!workerInstance && typeof Worker !== 'undefined') {
        workerInstance = new Worker(
          new URL('../workers/catalogQueryWorker.ts', import.meta.url),
          { type: 'module' }
        );

        workerInstance.onmessage = (event: MessageEvent) => {
          const { id, type, ...rest } = event.data;
          if (type === 'LOAD_SUCCESS') {
            isWorkerReady = true;
          }
          const callback = pendingQueries.get(id);
          if (callback) {
            pendingQueries.delete(id);
            callback(rest);
          }
        };
      }

      if (!workerInstance) return false;

      await new Promise<void>((resolve) => {
        const loadId = 'init_' + Math.random().toString(36).substring(2, 8);
        pendingQueries.set(loadId, () => {
          isWorkerReady = true;
          resolve();
        });
        workerInstance!.postMessage({
          type: 'LOAD_CATALOG',
          payload: records,
          id: loadId
        });
      });

      return true;
    } catch (e) {
      console.error('Failed to initialize catalog worker:', e);
      return false;
    } finally {
      workerInitPromise = null;
    }
  })();

  return workerInitPromise;
}

export async function queryLocalCatalog(
  params: LocalQueryParams,
  onProgress?: (percent: number) => void
): Promise<{ games: any[]; totalCount: number } | null> {
  if (typeof window === 'undefined') return null;

  if (!isWorkerReady) {
    const ready = await initCatalogWorker(onProgress);
    if (!ready || !workerInstance) return null;
  }

  const queryId = 'q_' + Math.random().toString(36).substring(2, 9);
  return new Promise((resolve) => {
    pendingQueries.set(queryId, (result) => {
      resolve({
        games: result.games || [],
        totalCount: result.totalCount || 0
      });
    });

    workerInstance!.postMessage({
      type: 'QUERY',
      payload: params,
      id: queryId
    });
  });
}

