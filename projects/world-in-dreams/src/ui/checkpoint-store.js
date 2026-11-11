// Large named checkpoints live in IndexedDB; existing browser checkpoints remain readable.
const DB_NAME = 'world-in-dreams:checkpoints:v1';
export function createCheckpointStore(indexedDB = globalThis.indexedDB) {
  let connection;
  function database() {
    if (!connection) connection = new Promise((resolve, reject) => {
      if (!indexedDB) return reject(new Error('Checkpoint storage is unavailable. Use Export.'));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('records');
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Checkpoint storage is busy in another tab. Use Export.'));
    });
    return connection;
  }
  async function get(key) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').get(key);
      tx.oncomplete = () => resolve(request.result ?? null); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  async function put(key, record) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite'), store = tx.objectStore('records');
      if (key === 'recovery') {
        const previous = store.get('recovery');
        previous.onsuccess = () => { if (previous.result) store.put(previous.result, 'previous'); store.put(record, key); };
      } else store.put(record, key);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  return { get, put, async slots() { return Promise.all(['slot1', 'slot2', 'slot3', 'previous'].map(async (key) => ({ key, record: await get(key) }))); } };
}
