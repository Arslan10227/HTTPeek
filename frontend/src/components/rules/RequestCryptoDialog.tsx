import React, { useState } from 'react';
import { X, Plus, Trash2, KeyRound, Lock, Unlock, ShieldCheck, Sparkles, Save } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { CryptoRule } from '../../types';
import { VisualMatchBuilder } from '../common/VisualMatchBuilder';

interface RequestCryptoDialogProps {
  onClose: () => void;
}

const ALGORITHMS = ['AES-CBC', 'AES-ECB', 'AES-GCM', 'AES-CTR', 'DES-CBC', '3DES-CBC'];
const ENCODINGS = ['base64', 'hex', 'raw'];

export const RequestCryptoDialog: React.FC<RequestCryptoDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { cryptoRules, setCryptoRules } = useProxyStore();

  const [rules, setRules] = useState<CryptoRule[]>(cryptoRules || []);
  const [name, setName] = useState('');
  const [urlPattern, setUrlPattern] = useState('');
  const [algorithm, setAlgorithm] = useState<any>('AES-CBC');
  const [encoding, setEncoding] = useState<any>('base64');
  const [secretKey, setSecretKey] = useState('');
  const [iv, setIv] = useState('');
  const [targetStage, setTargetStage] = useState<'both' | 'request' | 'response'>('response');

  const generateRandomKey = (bits = 256) => {
    const bytes = new Uint8Array(bits / 8);
    crypto.getRandomValues(bytes);
    if (encoding === 'hex') {
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const handleAdd = () => {
    if (!urlPattern.trim() || !secretKey.trim()) {
      toast.warning('URL pattern and Secret Key required');
      return;
    }
    const newRule: CryptoRule = {
      id: `crypto-${Date.now()}`,
      name: name.trim() || `${algorithm} Decryption`,
      urlPattern: urlPattern.trim(),
      algorithm,
      encoding,
      key: secretKey.trim(),
      iv: iv.trim(),
      target: targetStage,
      enabled: true,
    };
    setRules([...rules, newRule]);
    setName('');
    setUrlPattern('');
    setSecretKey('');
    setIv('');
    toast.success('Crypto Rule Added', `${newRule.name} (${newRule.algorithm})`);
  };

  const handleToggle = (index: number) => {
    const updated = [...rules];
    updated[index].enabled = !updated[index].enabled;
    setRules(updated);
  };

  const handleDelete = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      if (api.setCryptoRules) {
        await api.setCryptoRules(rules);
      }
      setCryptoRules(rules);
      toast.success(t.saveSuccess, 'Crypto rules saved');
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none p-4 font-sans">
      <div
        className="w-[680px] max-h-[90vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{t.requestCrypto} (Crypto Decryption &amp; Encryption Studio)</h2>
              <p className="text-[11px] text-gray-500">Automatically decrypt encrypted API payload bodies for live viewing and rewriting</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Match Builder */}
        <VisualMatchBuilder
          urlPattern={urlPattern}
          onChangeUrlPattern={setUrlPattern}
          title="Encrypted Endpoint Condition"
        />

        {/* Algorithm & Cipher Configuration */}
        <div className="p-4 rounded-xl border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/70 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">Cipher Algorithm:</label>
              <div className="flex items-center gap-1 flex-wrap">
                {ALGORITHMS.map((algo) => (
                  <button
                    key={algo}
                    type="button"
                    onClick={() => setAlgorithm(algo)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                      algorithm === algo
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {algo}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">Payload Encoding:</label>
              <div className="flex items-center gap-1.5">
                {ENCODINGS.map((enc) => (
                  <button
                    key={enc}
                    type="button"
                    onClick={() => setEncoding(enc)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase border transition-all cursor-pointer ${
                      encoding === enc
                        ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {enc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Key & IV Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-gray-500">Secret Key:</label>
                <button
                  type="button"
                  onClick={() => setSecretKey(generateRandomKey(256))}
                  className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Generate 256-bit
                </button>
              </div>
              <input
                type="text"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Secret Key (Base64/Hex)"
                className="w-full px-3 py-2 rounded-lg border font-mono text-xs bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-gray-500">IV Initialization Vector (Optional):</label>
                <button
                  type="button"
                  onClick={() => setIv(generateRandomKey(128))}
                  className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Generate 128-bit
                </button>
              </div>
              <input
                type="text"
                value={iv}
                onChange={(e) => setIv(e.target.value)}
                placeholder="IV Vector (Base64/Hex)"
                className="w-full px-3 py-2 rounded-lg border font-mono text-xs bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Target Stage */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Decrypt Target:</span>
            <div className="flex items-center gap-1.5">
              {[
                { stage: 'response', label: 'Response Body' },
                { stage: 'request', label: 'Request Body' },
                { stage: 'both', label: 'Both Directions' },
              ].map(({ stage, label }) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setTargetStage(stage as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    targetStage === stage
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs bg-cyan-600 text-white hover:bg-cyan-700 transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add Crypto Decryption Rule
          </button>
        </div>

        {/* Active Rules List */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
            <span>Configured Crypto Decryption Rules ({rules.length})</span>
            <span className="text-[11px] text-gray-400">Toggle switch to activate</span>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
            {rules.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400 border border-dashed rounded-xl">
                No active decryption rules. Configure keys and endpoints above.
              </div>
            ) : (
              rules.map((r, idx) => (
                <div
                  key={r.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-gray-400 transition-all"
                >
                  <div className="flex items-center gap-2.5 font-mono text-xs truncate">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => handleToggle(idx)}
                      className="w-4 h-4 rounded text-cyan-500 cursor-pointer accent-cyan-500"
                    />
                    <span className="font-bold text-gray-900 dark:text-gray-100 truncate">{r.urlPattern}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                      {r.algorithm} ({r.encoding || 'base64'})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer shadow-md transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            Save &amp; Apply Crypto Rules
          </button>
        </div>
      </div>
    </div>
  );
};
