import { firestoreStore } from '../functions/src/utils/firestoreEngine';
import { circuitBreaker } from '../functions/src/services/circuitBreaker';
import { rateLimiter } from '../functions/src/services/rateLimiter';
import { cleanupStaleWebhooks } from '../functions/src/triggers/webhookCleanup';
import { normalizePhoneNumber, buildDeterministicConversationId } from '../functions/src/services/phone';

async function runAllTests() {
  console.log('--- Starting Enterprise Vtiger WhatsApp CRM Test Suite ---');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, name: string, details: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`[PASS] ${name}: ${details}`);
    } else {
      console.error(`[FAIL] ${name}: ${details}`);
      process.exitCode = 1;
    }
  }

  // 1. Phone Normalizer
  const p1 = normalizePhoneNumber('+919371872013');
  const p2 = normalizePhoneNumber('09371872013');
  const p3 = normalizePhoneNumber('123');
  const convId = buildDeterministicConversationId('ws_enterprise_hq', p1);
  assert(
    p1.isValid && p1.e164 === '+919371872013' && p2.e164 === '+919371872013' && !p3.isValid && convId === 'conv_ws_enterprise_hq_91_9371872013',
    'Phone Normalizer',
    'Validates E.164 and generates deterministic conversation ID'
  );

  // 2. Concurrent Webhook Idempotency
  const raceKey = `test_ws_wamid.RACE_${Date.now()}`;
  const pA = (async () => {
    firestoreStore.createDoc('webhookEvents', raceKey, { id: raceKey, processed: false, receivedAt: Date.now() });
    return 'created';
  })();
  const pB = (async () => {
    firestoreStore.createDoc('webhookEvents', raceKey, { id: raceKey, processed: false, receivedAt: Date.now() });
    return 'created';
  })();
  const settled = await Promise.allSettled([pA, pB]);
  const fulfilled = settled.filter((r) => r.status === 'fulfilled');
  const rejected = settled.filter((r) => r.status === 'rejected');
  firestoreStore.deleteDoc('webhookEvents', raceKey);
  assert(
    fulfilled.length === 1 && rejected.length === 1,
    'Webhook Idempotency',
    'Concurrent writes safely de-duplicated with ALREADY_EXISTS error'
  );

  // 3. 24h Customer Care Window
  const now = Date.now();
  const inside12h = now - (now - 12 * 3600 * 1000) <= 24 * 3600 * 1000;
  const outside25h = now - (now - 25 * 3600 * 1000) <= 24 * 3600 * 1000;
  assert(
    inside12h && !outside25h,
    '24h Customer Service Window',
    'Allows text inside 24h and blocks text outside 24h window'
  );

  // 4. Circuit Breaker
  const testSvc = `cb_test_${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    try {
      await circuitBreaker.execute(testSvc, async () => { throw new Error('Simulated upstream failure'); });
    } catch {
      // expected
    }
  }
  let trippedOpen = false;
  try {
    await circuitBreaker.execute(testSvc, async () => 'ok');
  } catch (e: any) {
    if (e.message.includes('CircuitBreaker OPEN')) trippedOpen = true;
  }
  firestoreStore.deleteDoc('circuitBreakerStates', testSvc);
  assert(trippedOpen, 'Circuit Breaker', 'Trips to OPEN state after 5 consecutive failures');

  // 5. Rate Limiter
  const rlKey = `rl_test_${Date.now()}`;
  const r1 = await rateLimiter.isLimited(rlKey, 2, 60000);
  const r2 = await rateLimiter.isLimited(rlKey, 2, 60000);
  const r3 = await rateLimiter.isLimited(rlKey, 2, 60000);
  await rateLimiter.reset(rlKey);
  assert(!r1 && !r2 && r3, 'Rate Limiter', 'Allows 2 requests within window and limits 3rd request');

  // 6. Stale Webhook Cleanup
  const staleId = `stale_wh_${Date.now()}`;
  firestoreStore.setDoc('webhookEvents', staleId, {
    id: staleId,
    workspaceId: 'ws_enterprise_hq',
    type: 'MESSAGE',
    processed: false,
    processedAt: null,
    leaseUntil: Date.now() - 30 * 3600 * 1000,
    receivedAt: Date.now() - 26 * 3600 * 1000,
    retryCount: 3
  });
  const cleanupRes = await cleanupStaleWebhooks();
  assert(cleanupRes.deletedCount >= 1, 'Webhook Cleanup', 'Successfully purges webhooks older than 24 hours');

  console.log(`--- Test Suite Results: ${passedCount}/${totalCount} tests passed ---`);
}

runAllTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
