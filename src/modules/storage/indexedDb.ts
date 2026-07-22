const DB_NAME = 'piano-game'
const DB_VERSION = 3

export interface SongDataRecord {
  id: string
  data?: string
  midiData?: string
  musicXmlData?: string
}

export interface SettingsRecord {
  key: 'user-settings'
  value: any
}

export interface AppStateRecord {
  key: string
  value: any
}

function ensureIndex(store: IDBObjectStore, name: string, keyPath: string) {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, { unique: false })
}

function ensureSongMetadataIndexes(store: IDBObjectStore) {
  ensureIndex(store, 'hash', 'hash')
  ensureIndex(store, 'lastPlayed', 'lastPlayed')
  ensureIndex(store, 'title', 'title')
  ensureIndex(store, 'importedAt', 'importedAt')
}

function backfillSongMetadata(store: IDBObjectStore) {
  const request = store.openCursor()
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return

    const value = cursor.value as { importedAt?: number }
    if (value.importedAt == null) cursor.update({ ...value, importedAt: 0 })
    cursor.continue()
  }
}

export async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('songs-metadata')) {
        const metaStore = db.createObjectStore('songs-metadata', { keyPath: 'id' })
        ensureSongMetadataIndexes(metaStore)
      } else {
        const metaStore = request.transaction?.objectStore('songs-metadata')
        if (metaStore) {
          ensureSongMetadataIndexes(metaStore)
          backfillSongMetadata(metaStore)
        }
      }

      if (!db.objectStoreNames.contains('songs-data')) {
        db.createObjectStore('songs-data', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }

      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('app-state')) {
        db.createObjectStore('app-state', { keyPath: 'key' })
      }
    }
  })
}

export async function get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function put(storeName: string, value: any): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const request = tx.objectStore(storeName).put(value)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const request = tx.objectStore(storeName).delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function clear(storeName: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const request = tx.objectStore(storeName).clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

class PersistQueue {
  private queue: Promise<void> = Promise.resolve()

  enqueue(operation: () => Promise<void>): void {
    this.queue = this.queue
      .then(operation)
      .catch(err => {
        console.error('Persist operation failed:', err)
      })
  }
}

export const persistQueue = new PersistQueue()
