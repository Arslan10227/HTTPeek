import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  Plus, 
  Trash2, 
  Check, 
  Globe, 
  Key, 
  Save, 
  Copy,
  Info
} from 'lucide-react';
import { useProxyStore, Environment, EnvVariable } from '../../store/useProxyStore';
import { confirm } from '../../store/useConfirmDialog';

export const EnvironmentModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { environments, setEnvironments, activeEnvironmentId, setActiveEnvironmentId } = useProxyStore();
  const [selectedEnvId, setSelectedEnvId] = useState<string>(
    activeEnvironmentId || environments[0]?.id || 'global'
  );

  const selectedEnv = environments.find((e) => e.id === selectedEnvId) || environments[0];

  if (!isOpen) return null;

  const handleCreateEnv = () => {
    const newEnv: Environment = {
      id: `env-${Date.now()}`,
      name: 'New Environment',
      variables: [],
    };
    setEnvironments([...environments, newEnv]);
    setSelectedEnvId(newEnv.id);
  };

  const handleAddEnv = () => {
    const name = prompt('Enter Environment Name (e.g. Production, Testing):');
    if (!name) return;
    const newEnv: Environment = {
      id: 'env_' + Date.now(),
      name,
      variables: [],
    };
    setEnvironments([...environments, newEnv]);
    setSelectedEnvId(newEnv.id);
  };

  const handleDeleteEnv = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'global') return;
    const ok = await confirm({
      title: 'Delete Environment',
      message: 'Are you sure you want to delete this environment?',
      type: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    const updated = environments.filter((e) => e.id !== id);
    setEnvironments(updated);
    if (selectedEnvId === id) {
      setSelectedEnvId(updated[0]?.id || 'global');
    }
    if (activeEnvironmentId === id) {
      setActiveEnvironmentId(null);
    }
  };

  const handleAddVariable = () => {
    if (!selectedEnv) return;
    const newVar: EnvVariable = {
      key: '',
      value: '',
      enabled: true,
    };
    const updatedEnvs = environments.map((e) => {
      if (e.id === selectedEnv.id) {
        return { ...e, variables: [...e.variables, newVar] };
      }
      return e;
    });
    setEnvironments(updatedEnvs);
  };

  const handleUpdateVar = (index: number, field: keyof EnvVariable, val: any) => {
    if (!selectedEnv) return;
    const updatedVars = [...selectedEnv.variables];
    updatedVars[index] = { ...updatedVars[index], [field]: val };
    const updatedEnvs = environments.map((e) => {
      if (e.id === selectedEnv.id) {
        return { ...e, variables: updatedVars };
      }
      return e;
    });
    setEnvironments(updatedEnvs);
  };

  const handleDeleteVar = (index: number) => {
    if (!selectedEnv) return;
    const updatedVars = selectedEnv.variables.filter((_, idx) => idx !== index);
    const updatedEnvs = environments.map((e) => {
      if (e.id === selectedEnv.id) {
        return { ...e, variables: updatedVars };
      }
      return e;
    });
    setEnvironments(updatedEnvs);
  };

  return (
    <div className="htk-modal-overlay font-sans select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl h-[650px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-800">Environment & Variable Manager</h2>
              <p className="text-[11px] text-slate-400">Use {`{{variable_name}}`} across rules, composer, and scripts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Environments List */}
          <div className="w-60 bg-slate-50 border-r border-slate-200 p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-1 overflow-y-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Environments
              </span>
              {environments.map((env) => {
                const isSelected = env.id === selectedEnvId;
                const isActive = env.id === activeEnvironmentId;

                return (
                  <div
                    key={env.id}
                    onClick={() => setSelectedEnvId(env.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white shadow-xs border border-slate-200 text-emerald-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {env.isGlobal ? (
                        <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span className="truncate">{env.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Environment" />
                      )}
                      {!env.isGlobal && (
                        <button
                          onClick={(e) => handleDeleteEnv(env.id, e)}
                          className="text-slate-300 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleAddEnv}
              className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Environment</span>
            </button>
          </div>

          {/* Right: Variables Table */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* Top Bar for Selected Environment */}
            <div className="h-12 border-b border-slate-200 px-6 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-800">{selectedEnv?.name}</span>
                {selectedEnv?.isGlobal && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-200">
                    Always Applied
                  </span>
                )}
                {!selectedEnv?.isGlobal && activeEnvironmentId === selectedEnv?.id && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200">
                    Active
                  </span>
                )}
              </div>

              {!selectedEnv?.isGlobal && (
                <button
                  onClick={() => setActiveEnvironmentId(activeEnvironmentId === selectedEnv?.id ? null : selectedEnv?.id || null)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors border ${
                    activeEnvironmentId === selectedEnv?.id
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {activeEnvironmentId === selectedEnv?.id ? 'Active (Click to Deactivate)' : 'Set as Active'}
                </button>
              )}
            </div>

            {/* Variables Table */}
            <div className="flex-1 p-6 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-2">
                <div className="w-8 text-center">Use</div>
                <div className="w-1/3">Variable Key</div>
                <div className="flex-1 pl-3">Variable Value</div>
                <div className="w-8 text-center"></div>
              </div>

              {selectedEnv?.variables.length === 0 ? (
                <div className="h-44 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs">
                  <Key className="w-6 h-6 mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600">No Variables Defined</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Variable" to create a new token.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedEnv?.variables.map((variable, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="w-8 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={variable.enabled}
                          onChange={(e) => handleUpdateVar(idx, 'enabled', e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                        />
                      </div>

                      <div className="w-1/3">
                        <input
                          type="text"
                          value={variable.key}
                          onChange={(e) => handleUpdateVar(idx, 'key', e.target.value)}
                          placeholder="e.g. baseUrl"
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          value={variable.value}
                          onChange={(e) => handleUpdateVar(idx, 'value', e.target.value)}
                          placeholder="e.g. https://api.example.com"
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="w-8 flex items-center justify-center">
                        <button
                          onClick={() => handleDeleteVar(idx)}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleAddVariable}
                className="py-1.5 px-3 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variable</span>
              </button>
            </div>

            {/* Footer */}
            <div className="h-14 border-t border-slate-200 px-6 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Variables automatically interpolate in Composer, Scripts, and Rewrite rules.</span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
