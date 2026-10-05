import { firestoreStore } from '../utils/firestoreEngine';

export class RateLimiter {
  async isLimited(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<boolean> {
    const now = Date.now();

    try {
      let isLimited = false;
      await firestoreStore.runTransaction(async (t) => {
        const snap = t.get('rateLimitBuckets', key);
        const data = snap.data() || { key, count: 0, resetAt: now + windowMs };

        if (now >= data.resetAt) {
          t.set('rateLimitBuckets', key, {
            key,
            count: 1,
            resetAt: now + windowMs
          });
        } else {
          if (data.count >= maxRequests) {
            isLimited = true;
            return;
          }
          t.update('rateLimitBuckets', key, {
            count: { __op: 'increment', by: 1 }
          });
        }
      });
      return isLimited;
    } catch (err: any) {
      console.error('RateLimiter transaction failed, failing closed:', err);
      return true;
    }
  }

  async reset(key: string): Promise<void> {
    firestoreStore.deleteDoc('rateLimitBuckets', key);
  }
}

export const rateLimiter = new RateLimiter();
