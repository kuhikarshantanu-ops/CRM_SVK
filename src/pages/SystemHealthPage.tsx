import React, { useEffect, useState } from 'react';
import {
  WebhookEventRecord,
  CircuitStateRecord,
  RateLimitBucketRecord
} from '../types/crm';
import { collection, db, onSnapshot } from '../lib/firebase';
import { normalizePhoneNumber, buildDeterministicConversationId } from '../../functions/src/services/phone';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

export default function SystemHealthPage() {
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventRecord[]>([]);
  const [circuitStates, setCircuitStates] = useState<CircuitStateRecord[]>([]);
  const [rateBuckets, setRateBuckets] = useState<RateLimitBucketRecord[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [runningTests, setRunningTests] = useState(false);
  const [phoneInput, setPhoneInput] = useState('09371872013');

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'webhookEvents'), (snap) => {
      const list = snap.docs
        .map((d: any) => d.data() as WebhookEventRecord)
        .sort((a: WebhookEventRecord, b: WebhookEventRecord) => b.receivedAt - a.receivedAt);
      setWebhookEvents(list);
    });
    const u2 = onSnapshot(collection(db, 'circuitBreakerStates'), (snap) => {
      setCircuitStates(snap.docs.map((d: any) => d.data() as CircuitStateRecord));
    });
    const u3 = onSnapshot(collection(db, 'rateLimitBuckets'), (snap) => {
      setRateBuckets(snap.docs.map((d: any) => d.data() as RateLimitBucketRecord));
    });

    handleRunVerificationSuite();

    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const handleRunVerificationSuite = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/health/run-tests', { method: 'POST' });
      const data = await res.json();
      setTestResults(data.results || []);
    } finally {
      setRunningTests(false);
    }
  };

  const handleCircuitAction = async (name: string, action: 'trip' | 'reset') => {
    await fetch('/api/health/circuit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, action })
    });
  };

  const normalizedPreview = normalizePhoneNumber(phoneInput);
  const deterministicPreview = normalizedPreview.isValid
    ? buildDeterministicConversationId('ws_enterprise_hq', normalizedPreview)
    : 'INVALID_PHONE_FORMAT';

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              System Architecture & Resilience Diagnostics
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time inspection of Transactional CircuitBreakers, Fail-Closed RateLimiters, and Atomic Webhook Idempotency Locks
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunVerificationSuite}
            disabled={runningTests}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
          >
            {runningTests
              ? 'Running Verification Suite...'
              : 'Run Production Test Suite (6/6 Specs)'}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              01. Automated Production Test Suite Verification
            </h2>
            <span className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">
              {testResults.filter((t) => t.passed).length}/{testResults.length} Passing
            </span>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Subsystem</th>
                <th className="py-2.5 px-4">Specification Invariant</th>
                <th className="py-2.5 px-4">Execution Output</th>
                <th className="py-2.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {testResults.map((tr, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-semibold text-slate-900">
                    {tr.suite}
                  </td>
                  <td className="py-2.5 px-4 text-slate-700">{tr.name}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">
                    {tr.details}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold">
                    {tr.passed ? (
                      <span className="text-emerald-700">PASS ({tr.durationMs}ms)</span>
                    ) : (
                      <span className="text-red-600">FAIL</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  02. Transactional CircuitBreaker States
                </h2>
                <p className="text-xs text-slate-500">
                  Threshold = 5 failures · Reset Timeout = 60,000ms
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Rate Buckets Active: {rateBuckets.length}
              </span>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
              {circuitStates.map((cb) => (
                <div
                  key={cb.name}
                  className="p-3.5 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-xs font-mono font-semibold text-slate-900">
                      {cb.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                      State:{' '}
                      <span
                        className={
                          cb.status === 'CLOSED'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-red-600 font-semibold'
                        }
                      >
                        {cb.status}
                      </span>{' '}
                      · Failures: {cb.failureCount}/5
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cb.status === 'CLOSED' ? (
                      <button
                        type="button"
                        onClick={() => handleCircuitAction(cb.name, 'trip')}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded hover:bg-red-50"
                      >
                        Trip Circuit (OPEN)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCircuitAction(cb.name, 'reset')}
                        className="px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50"
                      >
                        Reset to CLOSED
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                03. Canonical Phone Normalizer & Deterministic ID Engine
              </h2>
              <p className="text-xs text-slate-500">
                Live test of `normalizePhoneNumber()` & `buildDeterministicConversationId()`
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Test Raw Phone Input (e.g. 09371872013, +91 93718-72013, 9371872013)
              </label>
              <input
                type="text"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">isValid:</span>
                <span
                  className={
                    normalizedPreview.isValid
                      ? 'text-emerald-700 font-semibold'
                      : 'text-red-600 font-semibold'
                  }
                >
                  {String(normalizedPreview.isValid)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Canonical E.164:</span>
                <span className="text-slate-900">{normalizedPreview.e164 || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Country / National:</span>
                <span className="text-slate-900">
                  +{normalizedPreview.countryCode} / {normalizedPreview.nationalNumber || '—'}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Deterministic Conv ID:</span>
                <span className="text-emerald-800 font-semibold">
                  {deterministicPreview}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                04. Webhook Idempotency Gate (`webhookEvents` Ledger)
              </h2>
              <p className="text-xs text-slate-500">
                Atomic `.create()` locks with status-qualified keys & 5m crash recovery leases
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {webhookEvents.length} recorded locks
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Idempotency Event Key</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">State</th>
                  <th className="py-2.5 px-4 text-right">Retries</th>
                  <th className="py-2.5 px-4 text-right">Received At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-mono">
                {webhookEvents.slice(0, 20).map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50">
                    <td className="py-2 px-4 text-slate-800 truncate max-w-md">
                      {ev.id}
                    </td>
                    <td className="py-2 px-4 text-slate-600">
                      {ev.type}
                      {ev.messageStatus ? ` (${ev.messageStatus})` : ''}
                    </td>
                    <td className="py-2 px-4">
                      {ev.processed ? (
                        <span className="text-emerald-700 font-semibold">
                          PROCESSED
                        </span>
                      ) : (
                        <span className="text-amber-700">LEASE_ACTIVE</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-slate-600">
                      {ev.retryCount}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-slate-500">
                      {new Date(ev.receivedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
