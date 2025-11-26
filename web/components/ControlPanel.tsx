
import React, { useState } from 'react';
import { TableAiFunction } from '../types';
import { TABLE_AI_FUNCTIONS } from '../data/tableAiFunctions';
import { executeAppsScriptFunction } from '../services/googleSheets';
import { ResultModal } from './ResultModal';

interface ControlPanelProps {
  scriptId: string;
  token: string;
  onLogout: () => void;
  onChangeScript: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ scriptId, token, onLogout, onChangeScript }) => {
  const [loadingFn, setLoadingFn] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{isOpen: boolean, title: string, content: string | null, isHtml: boolean}>({
    isOpen: false, title: '', content: null, isHtml: false
  });

  const handleFunctionClick = async (fn: TableAiFunction) => {
    setLoadingFn(fn.id);
    try {
      const result = await executeAppsScriptFunction(scriptId, fn.name, [], token);
      
      const output = result.response?.result;
      
      if (fn.returnsHtml) {
         // If function returns an HTML string, use it.
         // If it returns null (common if GAS function just called showModal), show a generic success message.
         const content = output ? (typeof output === 'object' ? JSON.stringify(output) : String(output)) : 'Функция выполнена (нет возвращаемого значения).';
         
         setModalState({
           isOpen: true,
           title: fn.label,
           content: content,
           isHtml: true
         });
      } else {
         // Action performed
         alert(`✅ ${fn.label}: Успешно выполнено`);
      }

    } catch (e: any) {
      alert(`❌ Ошибка: ${e.message}`);
    } finally {
      setLoadingFn(null);
    }
  };

  const renderSection = (title: string, category: string) => {
    const fns = TABLE_AI_FUNCTIONS.filter(f => f.category === category);
    if (fns.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{title}</h3>
        <div className="grid grid-cols-1 gap-3">
          {fns.map(fn => (
            <button
              key={fn.id}
              onClick={() => handleFunctionClick(fn)}
              disabled={!!loadingFn}
              className="relative flex items-center p-4 bg-white rounded-xl shadow-sm border border-slate-100 active:scale-[0.98] transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-2xl mr-4 shrink-0">
                {fn.icon === 'vk' ? <span className="font-bold text-blue-600 text-sm">VK</span> : fn.icon}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                   <h4 className="font-bold text-slate-800 truncate">{fn.label}</h4>
                   {loadingFn === fn.id && <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
                </div>
                <p className="text-xs text-slate-500 truncate">{fn.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] pb-safe">
      {/* Header */}
      <div className="bg-white px-6 py-5 shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Table AI
          </h1>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: ...{scriptId.slice(-6)}</p>
        </div>
        <div className="flex gap-3">
            <button onClick={onChangeScript} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                ⚙️
            </button>
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                🚪
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-lg mx-auto">
        {renderSection('AI Функции', 'ai')}
        {renderSection('Работа с данными', 'data')}
        {renderSection('Системные', 'settings')}
      </div>

      {/* Result Modal */}
      <ResultModal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({...prev, isOpen: false}))}
        title={modalState.title}
        content={modalState.content}
        isHtml={modalState.isHtml}
      />
    </div>
  );
};
