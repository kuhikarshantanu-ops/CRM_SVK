import React, { useState } from 'react';
import { X } from 'lucide-react';

interface DemoSandboxModalProps {
  onClose: () => void;
}

export default function DemoSandboxModal({ onClose }: DemoSandboxModalProps) {
  const [fromPhone, setFromPhone] = useState('+919371872013');
  const [profileName, setProfileName] = useState('Vikram Deshmukh');
  const [text, setText] = useState(
    'We just completed our security review. Can we schedule production onboarding?'
  );
  const [duplicateDeliveryCount, setDuplicateDeliveryCount] = useState(1);
  const [customWamid, setCustomWamid] = useState(
    `wamid.HBgM_${Date.now()}_IDEMPOTENT`
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    wamid: string;
    deliveriesAttempted: number;
    processedMessages: number;
    deduplicatedMessages: number;
  } | null>(null);

  const handlePresetSelect = (preset: 'existing' | 'new_lead' | 'idempotency_storm') => {
    setResult(null);
    if (preset === 'existing') {
      setFromPhone('+919371872013');
      setProfileName('Vikram Deshmukh');
      setText('Confirming receipt of the webhook HMAC-SHA256 implementation.');
      setDuplicateDeliveryCount(1);
      setCustomWamid(`wamid.HBgM_${Date.now()}_VIKRAM`);
    } else if (preset === 'new_lead') {
      const rand4 = Math.floor(1000 + Math.random() * 9000);
      setFromPhone(`+91984509${rand4}`);
      setProfileName('Neha Singhania');
      setText('Hi! Interested in connecting Vtiger CRM with WhatsApp Cloud API.');
      setDuplicateDeliveryCount(1);
      setCustomWamid(`wamid.HBgM_${Date.now()}_NEWLEAD`);
    } else if (preset === 'idempotency_storm') {
      setFromPhone('+919820451120');
      setProfileName('Ananya Krishnan');
      setText('Testing Meta webhook retry storm (5 identical wamid deliveries).');
      setDuplicateDeliveryCount(5);
      setCustomWamid(`wamid.HBgM_${Date.now()}_RETRY_STORM`);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/demo/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPhone,
          profileName,
          text,
          customWamid,
          duplicateDeliveryCount
        })
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Credential-Free Demo Webhook Simulator
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Injects real Meta Graph v21.0 payloads through atomic idempotency & Vtiger VQL pipeline
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSimulate} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Test Scenario Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handlePresetSelect('existing')}
                className="px-3 py-2 text-xs font-medium border border-slate-200 rounded hover:bg-slate-50 text-left"
              >
                <div className="text-slate-900 font-semibold">Existing Contact</div>
                <div className="text-[11px] text-slate-500">Matches 12x456</div>
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('new_lead')}
                className="px-3 py-2 text-xs font-medium border border-slate-200 rounded hover:bg-slate-50 text-left"
              >
                <div className="text-slate-900 font-semibold">New Number</div>
                <div className="text-[11px] text-slate-500">Auto-creates 10x Lead</div>
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('idempotency_storm')}
                className="px-3 py-2 text-xs font-medium border border-slate-200 rounded hover:bg-slate-50 text-left"
              >
                <div className="text-slate-900 font-semibold">5x Retry Storm</div>
                <div className="text-[11px] text-slate-500">Atomic Deduplication</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Sender Phone (Raw / E.164)
              </label>
              <input
                type="text"
                value={fromPhone}
                onChange={(e) => setFromPhone(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                WhatsApp Profile Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Meta External Message ID (wamid)
              </label>
              <input
                type="text"
                value={customWamid}
                onChange={(e) => setCustomWamid(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Webhook Retries
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={duplicateDeliveryCount}
                onChange={(e) => setDuplicateDeliveryCount(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Inbound Message Payload
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              className="w-full p-2.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-600"
            />
          </div>

          {result && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs space-y-1">
              <div className="font-semibold text-emerald-900">
                Webhook Ingestion Result [DEMO SIMULATED]
              </div>
              <div className="text-emerald-800 font-mono">
                wamid: {result.wamid}
              </div>
              <div className="flex items-center gap-3 text-emerald-800 pt-1">
                <span>Deliveries Sent: {result.deliveriesAttempted}</span>
                <span>·</span>
                <span className="font-semibold">
                  Processed: {result.processedMessages}
                </span>
                <span>·</span>
                <span className="font-semibold">
                  Deduplicated (ALREADY_EXISTS): {result.deduplicatedMessages}
                </span>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {submitting ? 'Simulating Webhook...' : 'Fire Inbound Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
