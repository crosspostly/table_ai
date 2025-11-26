
import React, { useState, useEffect } from 'react';
import { ButtonInfo, TableAiFunction } from '../types';
import { TABLE_AI_FUNCTIONS } from '../data/tableAiFunctions';
import { fetchSpreadsheetButtons, executeGoogleScript } from '../services/googleSheets';
import { ResultModal } from './ResultModal';

interface ActionPanelProps {
  spreadsheetId: string;
  token: string;
  scriptId?: string | null;
  onUpdateScriptId: (id: string) => void;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ spreadsheetId, token, scriptId, onUpdateScriptId }) => {
  const [buttons, setButtons] = useState<ButtonInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [tempScriptId, setTempScriptId] = useState(scriptId || '');
  const [isEditingId, setIsEditingId] = useState(!scriptId);
  
  // Result Modal State
  const [modalState, setModalState] = useState<{isOpen: boolean, title: string, content: string | null, isHtml: boolean}>({
    isOpen: false, title: '', content: null, isHtml: false
  });

  useEffect(() => {
    loadButtons();
  }, [spreadsheetId]);

  const loadButtons = async () => {
    setLoading(true);
    try {
      const data = await fetchSpreadsheetButtons(spreadsheetId, token);
      setButtons(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (functionName: string, label: string, returnsHtml: boolean = false) => {
    if (!scriptId) {
      alert("Скрипт не подключен. Пожалуйста, введите Script ID.");
      setIsEditingId(true);
      return;
    }

    setExecuting(functionName);
    try {
      const result = await executeGoogleScript(scriptId, functionName, [], token);
      const output = result.response?.result;

      if (returnsHtml) {
         const content = output ? (typeof output === 'object' ? JSON.stringify(output) : String(output)) : 'Функция выполнена (нет возвращаемого значения).';
         setModalState({
           isOpen: true,
           title: label,
           content: content,
           isHtml: true
         });
      } else {
        alert(`✅ ${label}: Успешно выполнено`);
      }
    } catch (e: any) {
      alert(`❌ Ошибка выполнения: ${e.message}`);
    } finally {
      setExecuting(null);
    }
  };

  const saveScriptId = () => {
    onUpdateScriptId(tempScriptId);
    setIsEditingId(false);
  };

  return (
    <div className="p-4 pb-24 space-y-6">
      {/* Script ID Config */}
      <div className={`p-4 rounded-xl border shadow-sm ${scriptId ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className={`font-bold ${scriptId ? 'text-green-800' : 'text-yellow-800'}`}>
            {scriptId ? 'Скрипт подключен' : 'Требуется настройка'}
          </h3>
          <button 
             onClick={() => setIsEditingId(!isEditingId)}
             className="text-xs text-indigo-600 font-bold"
          >
            {isEditingId ? 'Отмена' : 'Изменить ID'}
          </button>
        </div>
        
        {isEditingId ? (
          <div className="space-y-3 animate-fade-in">
            <div className="text-xs text-slate-600 bg-white p-3 rounded border border-slate-100">
              <p className="font-bold mb-1">Как найти Script ID:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Откройте таблицу на компьютере</li>
                <li>Меню <b>Extensions</b> → <b>Apps Script</b></li>
                <li>В скрипте: <b>Project Settings</b> (шестеренка)</li>
                <li>Скопируйте <b>Script ID</b></li>
              </ol>
            </div>
            <input 
              value={tempScriptId}
              onChange={(e) => setTempScriptId(e.target.value)}
              placeholder="Вставьте Script ID сюда..."
              className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button 
              onClick={saveScriptId}
              disabled={!tempScriptId}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
            >
              Сохранить ID
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${scriptId ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs font-mono text-slate-600 truncate flex-1">
              {scriptId}
            </span>
          </div>
        )}
      </div>

      {/* Standard Functions Section */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Основные функции</h2>
        <div className="grid grid-cols-1 gap-3">
          {TABLE_AI_FUNCTIONS.map((fn) => (
            <button
              key={fn.id}
              onClick={() => handleExecute(fn.name, fn.label, fn.returnsHtml)}
              disabled={!!executing || !scriptId}
              className="relative flex items-center p-4 bg-white rounded-xl shadow-sm border border-slate-100 active:scale-[0.98] transition-all disabled:opacity-50"
            >
               <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-2xl mr-4 shrink-0">
                  {fn.icon}
               </div>
               <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center">
                     <span className="font-bold text-slate-800 truncate">{fn.label}</span>
                     {executing === fn.name && <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{fn.description}</p>
               </div>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Sheet Buttons */}
      <div>
        <div className="flex justify-between items-center mb-3 mt-6">
           <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Скрипты таблицы</h2>
           <button onClick={loadButtons} className="text-indigo-600 text-xs font-bold">↻ Обновить</button>
        </div>

        {loading ? (
          <div className="text-center py-4 text-slate-400 text-sm">Загрузка...</div>
        ) : buttons.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p className="text-sm text-slate-500 mb-1">Нет дополнительных кнопок</p>
            <p className="text-[10px] text-slate-400 px-4">
              Создайте лист <b>_buttons</b> (Label, Function, Desc, Color)
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {buttons.map((btn, idx) => (
              <button
                key={idx}
                onClick={() => handleExecute(btn.functionName, btn.label, false)}
                disabled={!!executing || !scriptId}
                className="relative overflow-hidden bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-left active:scale-[0.98] transition-all group disabled:opacity-50"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${btn.color === 'red' ? 'bg-red-500' : btn.color === 'green' ? 'bg-green-500' : 'bg-indigo-500'}`}></div>
                <div className="pl-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">{btn.label}</span>
                    {executing === btn.functionName && <span className="animate-spin text-indigo-600">⟳</span>}
                  </div>
                  {btn.description && (
                    <p className="text-xs text-slate-500 mt-1">{btn.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
