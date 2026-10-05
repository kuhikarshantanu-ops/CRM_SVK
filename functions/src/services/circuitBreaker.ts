import { firestoreStore } from '../utils/firestoreEngine';

export interface CircuitState {
  name?: string;
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
}

export class CircuitBreaker {
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    let state: CircuitState | null = null;

    await firestoreStore.runTransaction(async (t) => {
      const snap = t.get('circuitBreakerStates', name);
      state = (snap.data() || {
        name,
        status: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0
      }) as CircuitState;

      if (
        state!.status === 'OPEN' &&
        Date.now() - state!.lastFailureTime > this.resetTimeout
      ) {
        state!.status = 'HALF_OPEN';
      }

      t.set('circuitBreakerStates', name, { ...state!, name });
    });

    if (state!.status === 'OPEN') {
      throw new Error(
        `CircuitBreaker OPEN for ${name}. Service temporarily unavailable.`
      );
    }

    try {
      const result = await fn();

      firestoreStore.setDoc('circuitBreakerStates', name, {
        name,
        status: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0
      });

      return result;
    } catch (err) {
      await firestoreStore.runTransaction(async (t) => {
        const snap = t.get('circuitBreakerStates', name);
        const current = (snap.data() || {
          name,
          status: 'CLOSED',
          failureCount: 0,
          lastFailureTime: 0
        }) as CircuitState;

        current.failureCount++;

        if (current.failureCount >= this.failureThreshold) {
          current.status = 'OPEN';
          current.lastFailureTime = Date.now();
        }

        t.set('circuitBreakerStates', name, { ...current, name });
      });

      throw err;
    }
  }

  async tripCircuit(name: string): Promise<void> {
    firestoreStore.setDoc('circuitBreakerStates', name, {
      name,
      status: 'OPEN',
      failureCount: this.failureThreshold,
      lastFailureTime: Date.now()
    });
  }

  async resetCircuit(name: string): Promise<void> {
    firestoreStore.setDoc('circuitBreakerStates', name, {
      name,
      status: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0
    });
  }
}

export const circuitBreaker = new CircuitBreaker();
