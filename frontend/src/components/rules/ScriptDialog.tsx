import React, { useState } from 'react';
import { X, Code2, Play, Plus, Trash2, Check, FileText } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useProxyStore } from '../../store/useProxyStore';
import { useAppConfig } from '../../theme/useAppConfig';
import { toast } from '../../store/useToastStore';
import { api } from '../../store/apiAdapter';
import { ScriptRule } from '../../types';

interface ScriptDialogProps {
  onClose: () => void;
}

const DEFAULT_SCRIPT_TEMPLATE = `// ProxyPin JavaScript Interceptor
// Available hooks: onRequest(request), onResponse(request, response)

function onRequest(request) {
  // console.log("Request to:", request.url);
  // Modify headers, url, or body:
  // request.headers["X-Custom-Header"] = "ProxyPin-Go";
  return request;
}

function onResponse(request, response) {
  // console.log("Response status:", response.statusCode);
  // Modify response body or headers:
  // if (request.url.includes("/api/user")) {
  //   response.body = JSON.stringify({ name: "Mocked User", vip: true });
  // }
  return response;
}
`;

export const ScriptDialog: React.FC<ScriptDialogProps> = ({ onClose }) => {
  const { t, language } = useTranslation();
  const { scripts, setScripts } = useProxyStore();
  const { getActiveColorPreset } = useAppConfig();
  const activeColor = getActiveColorPreset();

  const [scriptList, setScriptList] = useState<ScriptRule[]>(() => {
    if (scripts && scripts.length > 0) return scripts;
    return [
      {
        id: 'script-default',
        name: 'Default Script',
        urlPattern: '*',
        script: DEFAULT_SCRIPT_TEMPLATE,
        enabled: true,
      },
    ];
  });

  const [activeScriptId, setActiveScriptId] = useState<string>(
    scriptList[0]?.id || 'script-default'
  );

  const activeScript = scriptList.find((s) => s.id === activeScriptId) || scriptList[0];

  const handleUpdateScriptCode = (code: string) => {
    setScriptList(
      scriptList.map((s) => (s.id === activeScript.id ? { ...s, script: code } : s))
    );
  };

  const handleAddScript = () => {
    const newScript: ScriptRule = {
      id: `script-${Date.now()}`,
      name: `Script ${scriptList.length + 1}`,
      urlPattern: '*',
      script: DEFAULT_SCRIPT_TEMPLATE,
      enabled: true,
    };
    setScriptList([...scriptList, newScript]);
    setActiveScriptId(newScript.id);
  };

  const handleRemoveScript = (id: string) => {
    if (scriptList.length <= 1) {
      toast.warning('Cannot delete the only script');
      return;
    }
    const filtered = scriptList.filter((s) => s.id !== id);
    setScriptList(filtered);
    if (activeScriptId === id) {
      setActiveScriptId(filtered[0].id);
    }
  };

  const handleSave = async () => {
    try {
      if (api.setScripts) {
        await api.setScripts(scriptList);
      }
      setScripts(scriptList);
      toast.success(t.saveSuccess, 'Scripts updated');
      onClose();
    } catch (e: any) {
      toast.error(t.fail, e?.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      <div
        className="w-[820px] h-[85vh] rounded-2xl shadow-2xl p-6 border flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 text-xs"
        style={{
          backgroundColor: 'var(--md-dialog-bg)',
          borderColor: 'var(--md-sys-color-divider)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5" style={{ color: activeColor.hex }} />
            <h2 className="text-sm font-semibold">{t.script} (JavaScript Interceptor)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 flex gap-3 min-h-0">
          {/* Left Script Selector */}
          <div
            className="w-56 border rounded-xl flex flex-col p-2 gap-1.5 overflow-y-auto shrink-0"
            style={{ borderColor: 'var(--md-sys-color-divider)' }}
          >
            <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-800">
              <span className="font-bold text-[11px] text-gray-500">Scripts</span>
              <button
                type="button"
                onClick={handleAddScript}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-blue-500 cursor-pointer"
                title="Add Script"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {scriptList.map((s) => {
              const isActive = s.id === activeScriptId;
              return (
                <div
                  key={s.id}
                  onClick={() => setActiveScriptId(s.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        setScriptList(
                          scriptList.map((item) =>
                            item.id === s.id ? { ...item, enabled: e.target.checked } : item
                          )
                        );
                      }}
                      className="rounded"
                    />
                    <span className="truncate">{s.name}</span>
                  </div>
                  {scriptList.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveScript(s.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Script Editor */}
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            {activeScript && (
              <>
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <input
                    type="text"
                    value={activeScript.name}
                    onChange={(e) =>
                      setScriptList(
                        scriptList.map((s) =>
                          s.id === activeScript.id ? { ...s, name: e.target.value } : s
                        )
                      )
                    }
                    placeholder="Script Name"
                    className="px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                  <input
                    type="text"
                    value={activeScript.urlPattern}
                    onChange={(e) =>
                      setScriptList(
                        scriptList.map((s) =>
                          s.id === activeScript.id ? { ...s, urlPattern: e.target.value } : s
                        )
                      )
                    }
                    placeholder="Match URL Pattern (e.g. * or api.test.com/*)"
                    className="px-3 py-1.5 rounded-lg border font-mono text-xs bg-transparent focus:outline-none"
                    style={{ borderColor: 'var(--md-sys-color-outline)' }}
                  />
                </div>

                <textarea
                  value={activeScript.script}
                  onChange={(e) => handleUpdateScriptCode(e.target.value)}
                  className="w-full flex-1 p-3 rounded-xl border font-mono text-xs bg-transparent focus:outline-none resize-none select-text leading-relaxed"
                  style={{
                    borderColor: 'var(--md-sys-color-outline)',
                    color: 'var(--md-sys-color-on-surface)',
                  }}
                  spellCheck={false}
                />
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800 shrink-0">
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
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
};
