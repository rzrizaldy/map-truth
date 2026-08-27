import type { GeographyLock, SourceFeature } from '../types/maptruth'

type CachedLock = { lock: GeographyLock; features: SourceFeature[] }
const DB_NAME = 'maptruth-live-osm'
const STORE_NAME = 'viewport-locks'

const openDatabase = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const readCachedLock = async (key: string): Promise<CachedLock | null> => {
  const database = await openDatabase()
  if (!database) return null
  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve((request.result as CachedLock | undefined) ?? null)
    request.onerror = () => resolve(null)
    transaction.oncomplete = () => database.close()
  })
}

export const writeCachedLock = async (key: string, value: CachedLock): Promise<void> => {
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(value, key)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); resolve() }
  })
}
