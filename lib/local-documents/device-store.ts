import type { LocalFileIdentity } from "./types";

const DB_NAME = "marginalia-local-documents";
const STORE_NAME = "associations";
const DB_VERSION = 1;

export type DeviceFileAssociation = LocalFileIdentity & {
  sourceId: string;
  handle?: FileSystemFileHandle;
  linkedAt: string;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("Local document persistence is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME, { keyPath: "sourceId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local document storage."));
  });
}

export async function saveDeviceFileAssociation(
  association: Omit<DeviceFileAssociation, "linkedAt">,
) {
  const database = await openDatabase();
  const write = (value: Omit<DeviceFileAssociation, "linkedAt">) =>
    new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        ...value,
        linkedAt: new Date().toISOString(),
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not remember this document on this device."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not remember this document on this device."));
    });
  try {
    try {
      await write(association);
    } catch (error) {
      if (!association.handle) throw error;
      const { handle: _handle, ...metadataOnly } = association;
      void _handle;
      await write(metadataOnly);
    }
  } finally {
    database.close();
  }
}

export async function getDeviceFileAssociation(sourceId: string) {
  const database = await openDatabase();
  try {
    return await new Promise<DeviceFileAssociation | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(sourceId);
      request.onsuccess = () => resolve(request.result as DeviceFileAssociation | undefined);
      request.onerror = () => reject(request.error ?? new Error("Could not read local document storage."));
    });
  } finally {
    database.close();
  }
}

export async function getLinkedFile(sourceId: string) {
  const association = await getDeviceFileAssociation(sourceId);
  if (!association?.handle) return null;
  try {
    return await association.handle.getFile();
  } catch {
    return null;
  }
}
