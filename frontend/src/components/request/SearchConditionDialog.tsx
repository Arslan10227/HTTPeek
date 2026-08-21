import React, { useState } from 'react';
import { X, Filter, Search } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppConfig } from '../../theme/useAppConfig';

export interface SearchFilterConditions {
  keyword: string;
  method: string;
  statusCode: string;
  contentType: string;
  searchRequestHeader: boolean;
  searchRequestBody: boolean;
  searchResponseHeader: boolean;
  searchResponseBody: boolean;
  caseSensitive: boolean;
  isRegex: boolean;
  // Advanced filters (Phase 9-A)
  protocol: string;          // '', 'http', 'https', 'ws', 'wss', 'sse'
  minDurationMs: string;     // empty = no filter
  maxDurationMs: string;     // empty = no filter
  minSizeBytes: string;      // empty = no filter
  maxSizeBytes: string;      // empty = no filter
  hasRuleHits: boolean;      // filter to requests with appliedRules
  bodyRegex: string;         // regex to test against request+response bodies
  processName: string;       // Phase 9-C: filter by process name
}

export const defaultSearchConditions: SearchFilterConditions = {
  keyword: '',
  method: '',
  statusCode: '',
  contentType: '',
  searchRequestHeader: true,
  searchRequestBody: true,
  searchResponseHeader: true,
  searchResponseBody: true,
  caseSensitive: false,
  isRegex: false,
  protocol: '',
  minDurationMs: '',
  maxDurationMs: '',
  minSizeBytes: '',
  maxSizeBytes: '',
  hasRuleHits: false,
  bodyRegex: '',
  processName: '',
};

interface SearchConditionDialogProps {
  conditions: SearchFilterConditions;
  onApply: (conds: SearchFilterConditions) => void;
  onClose: () => void;
}

export const SearchConditionDialog: React.FC<SearchConditionDialogProps> = ({
  conditions,
  onApply,
  onClose,
}) => {
  const { t, language } = useTranslation();
  const { getActiveColorPreset } = useAppConfig();
  const [form, setForm] = useState<SearchFilterConditions>({ ...conditions });
  const activeColor = getActiveColorPreset();

  const isZh = language.startsWith('zh');

  const methods = ['', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'WS', 'SSE'];

  const handleReset = () => {
    setForm({ ...defaultSearchConditions });
  };

  const handleSave = () => {
    onApply(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[480px] max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl p-6 border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" style={{ color: activeColor.hex }} />
            <h2 className="text-sm font-semibold">{isZh ? '高级搜索条件' : 'Search Conditions'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-3">
          {/* Keyword */}
          <div className="flex flex-col gap-1">
            <label className="font-medium">{isZh ? '关键词 (URL / 路径 / 内容):' : 'Keyword:'}</label>
            <input
              type="text"
              value={form.keyword}
              onChange={(e) => setForm({ ...form, keyword: e.target.value })}
              placeholder="e.g. api/v1/user"
              className="px-3 py-1.5 rounded-lg border bg-transparent font-mono focus:outline-none"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            />
          </div>

          {/* Method & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-medium">{isZh ? '请求方法:' : 'Method:'}</label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none cursor-pointer"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
              >
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m || (isZh ? '全部方法' : 'All Methods')}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium">{isZh ? '状态码:' : 'Status Code:'}</label>
              <input
                type="text"
                value={form.statusCode}
                onChange={(e) => setForm({ ...form, statusCode: e.target.value })}
                placeholder="200, 404, 5xx"
                className="px-3 py-1.5 rounded-lg border bg-transparent font-mono focus:outline-none"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
              />
            </div>
          </div>

          {/* Content-Type */}
          <div className="flex flex-col gap-1">
            <label className="font-medium">Content-Type:</label>
            <input
              type="text"
              value={form.contentType}
              onChange={(e) => setForm({ ...form, contentType: e.target.value })}
              placeholder="application/json, text/html, image"
              className="px-3 py-1.5 rounded-lg border bg-transparent font-mono focus:outline-none"
              style={{ borderColor: 'var(--md-sys-color-outline)' }}
            />
          </div>

          {/* Search Scopes */}
          <div className="flex flex-col gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
            <span className="font-semibold text-gray-600 dark:text-gray-400">
              {isZh ? '搜索匹配范围:' : 'Search Scope:'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.searchRequestHeader}
                  onChange={(e) => setForm({ ...form, searchRequestHeader: e.target.checked })}
                  className="rounded"
                />
                <span>{isZh ? '请求头 (Headers)' : 'Request Headers'}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.searchRequestBody}
                  onChange={(e) => setForm({ ...form, searchRequestBody: e.target.checked })}
                  className="rounded"
                />
                <span>{isZh ? '请求体 (Body)' : 'Request Body'}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.searchResponseHeader}
                  onChange={(e) => setForm({ ...form, searchResponseHeader: e.target.checked })}
                  className="rounded"
                />
                <span>{isZh ? '响应头 (Headers)' : 'Response Headers'}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.searchResponseBody}
                  onChange={(e) => setForm({ ...form, searchResponseBody: e.target.checked })}
                  className="rounded"
                />
                <span>{isZh ? '响应体 (Body)' : 'Response Body'}</span>
              </label>
            </div>
          </div>

          {/* Regex & Case Sensitive */}
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.caseSensitive}
                onChange={(e) => setForm({ ...form, caseSensitive: e.target.checked })}
                className="rounded"
              />
              <span>{isZh ? '区分大小写' : 'Case Sensitive'}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isRegex}
                onChange={(e) => setForm({ ...form, isRegex: e.target.checked })}
                className="rounded"
              />
              <span>{isZh ? '正则表达式' : 'Regular Expression'}</span>
            </label>
          </div>

          {/* Advanced Filters (Phase 9-A) */}
          <div className="flex flex-col gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="font-semibold text-gray-600 dark:text-gray-400">
              {isZh ? '高级过滤:' : 'Advanced Filters:'}
            </span>

            {/* Protocol */}
            <div className="flex flex-col gap-1">
              <label className="font-medium">{isZh ? '协议:' : 'Protocol:'}</label>
              <select
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                className="px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none cursor-pointer"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
              >
                {['', 'http', 'https', 'ws', 'wss', 'sse'].map((p) => (
                  <option key={p} value={p}>
                    {p || (isZh ? '全部协议' : 'All Protocols')}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-medium">{isZh ? '最小耗时 (ms):' : 'Min Duration (ms):'}</label>
                <input
                  type="text"
                  value={form.minDurationMs}
                  onChange={(e) => setForm({ ...form, minDurationMs: e.target.value })}
                  placeholder="e.g. 100"
                  className="px-3 py-1.5 rounded-lg border bg-transparent font-mono focus:outline-none"
                  style={{ borderColor: 'var(--md-sys-color-outline)' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-medium">{isZh ? '最大耗时 (ms):' : 'Max Duration (ms):'}</label>
                <input
                  type="text"
                  value={form.maxDurationMs}
                  onChange={(e) => setForm({ ...form, maxDurationMs: e.target.value })}
                  placeholder="e.g. 5000"
                  className="px-3 py-1.5 rounded-lg border bg-transparent font-mono focus:outline-none"
                  style={{ borderColor: 'var(--md-sys-color-outline)' }}
                />
              </div>
            </div>

            {/* Size range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-medium">{isZh ? '最小大小 (bytes):' : 'Min Size (bytes):'}</label>
                <input
                  type="text"
                  value={form.minSizeBytes}
                  onChange={(e) => setForm({ ...form, minSizeBytes: e.target.value })}
                  placeholder="e.g. 1024"
                  className="px-3 py-1.5 rounded-lg border bg-transparent font-mono focus:outline-none"
                  style={{ borderColor: 'var(--md-sys-color-outline)' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-medium">{isZh ? '最大大小 (bytes):' : 'Max Size (bytes):'}</label>
                <input
                  type="text"
                  value={form.maxSizeBytes}
                  onChange={(e) => setForm({ ...form, maxSizeBytes: e.target.value })}
                  placeholder="e.g. 1048576"
                  className="px-3 py-1.5 rounded-lg border bg-transparent font-mono focus:outline-none"
                  style={{ borderColor: 'var(--md-sys-color-outline)' }}
                />
              </div>
            </div>

            {/* Rule hits + body regex */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasRuleHits}
                onChange={(e) => setForm({ ...form, hasRuleHits: e.target.checked })}
                className="rounded"
              />
              <span>{isZh ? '仅显示命中规则的请求' : 'Only requests with rule hits'}</span>
            </label>

            <div className="flex flex-col gap-1">
              <label className="font-medium">{isZh ? 'Body 正则匹配:' : 'Body Regex:'}</label>
              <input
                type="text"
                value={form.bodyRegex}
                onChange={(e) => setForm({ ...form, bodyRegex: e.target.value })}
                placeholder={'e.g. "token"|"password"'}
                className="px-3 py-1.5 rounded-lg border bg-transparent font-mono focus:outline-none"
                style={{ borderColor: 'var(--md-sys-color-outline)' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
          >
            {t.reset}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              style={{ borderColor: 'var(--md-sys-color-divider)' }}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 rounded-lg font-medium text-xs text-white cursor-pointer shadow-xs transition-opacity hover:opacity-90"
              style={{ backgroundColor: activeColor.hex }}
            >
              {t.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
