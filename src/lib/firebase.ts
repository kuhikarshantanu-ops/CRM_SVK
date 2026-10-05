export type Unsubscribe = () => void;

class RealtimeCollectionChannel {
  private listeners: Set<(docs: any[]) => void> = new Set();
  private eventSource: EventSource | null = null;
  private latestDocs: any[] = [];
  private initialized = false;

  constructor(private readonly collectionName: string) {}

  public subscribe(cb: (docs: any[]) => void): Unsubscribe {
    this.listeners.add(cb);
    if (this.initialized) {
      cb(this.latestDocs);
    } else {
      this.fetchInitial();
    }
    this.ensureStream();

    return () => {
      this.listeners.delete(cb);
      if (this.listeners.size === 0 && this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    };
  }

  private async fetchInitial() {
    try {
      const res = await fetch(`/api/firestore/collection/${this.collectionName}`);
      if (res.ok) {
        const data = await res.json();
        this.latestDocs = data.docs || [];
        this.initialized = true;
        this.notify();
      }
    } catch (e) {
      console.error(`Failed initial fetch for ${this.collectionName}:`, e);
    }
  }

  private ensureStream() {
    if (this.eventSource) return;
    try {
      const es = new EventSource(`/api/firestore/stream/${this.collectionName}`);
      es.onmessage = (event) => {
        try {
          const docs = JSON.parse(event.data);
          this.latestDocs = docs;
          this.initialized = true;
          this.notify();
        } catch (err) {
          console.error('Error parsing SSE snapshot:', err);
        }
      };
      es.onerror = () => {};
      this.eventSource = es;
    } catch (e) {
      console.error('EventSource init error:', e);
    }
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.latestDocs));
  }
}

const channels = new Map<string, RealtimeCollectionChannel>();

function getChannel(collectionName: string): RealtimeCollectionChannel {
  let ch = channels.get(collectionName);
  if (!ch) {
    ch = new RealtimeCollectionChannel(collectionName);
    channels.set(collectionName, ch);
  }
  return ch;
}

export const db = {
  name: 'enterprise-vtiger-firestore'
};

export function collection(_db: any, collectionName: string) {
  return { type: 'collection' as const, collectionName };
}

export function doc(_db: any, collectionName: string, docId: string) {
  return { type: 'doc' as const, collectionName, docId };
}

export function onSnapshot(
  target: { type: 'collection' | 'doc'; collectionName: string; docId?: string },
  callback: (snapshot: any) => void
): Unsubscribe {
  const ch = getChannel(target.collectionName);
  if (target.type === 'collection') {
    return ch.subscribe((docs) => {
      callback({
        docs: docs.map((d) => ({
          id: d.id,
          data: () => d,
          exists: () => true
        })),
        empty: docs.length === 0
      });
    });
  } else {
    return ch.subscribe((docs) => {
      const found = docs.find(
        (d) => d.id === target.docId || d.compoundId === target.docId
      );
      callback({
        id: target.docId,
        exists: () => Boolean(found),
        data: () => found
      });
    });
  }
}

export async function updateFirestoreDoc(
  collectionName: string,
  docId: string,
  updates: Record<string, any>
) {
  const res = await fetch(`/api/firestore/doc/${collectionName}/${docId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Firestore update rejected');
  }
  return data.doc;
}

export async function createFirestoreDoc(
  collectionName: string,
  payload: Record<string, any>
) {
  const res = await fetch(`/api/firestore/doc/${collectionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Firestore create rejected');
  }
  return data.doc;
}
