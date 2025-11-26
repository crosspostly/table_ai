import React, { useState, useEffect } from 'react';
import { ScriptStatus } from '../types';
import { executeGoogleScript } from '../services/googleSheets';
import { ResultModal } from './ResultModal';

// Временной интерфейс для ScriptFunction
interface ScriptFunction {
  name: string;
  label: string;
  description: string;
  category: 'ai' | 'data' | 'settings' | 'dev';
  menuPath: string;
  order: number;
  returnsHtml?: boolean;
}

interface EnhancedActionPanelProps {
  spreadsheetId: string;
  token: string;
  scriptStatus: ScriptStatus;
  onRefreshScript: () => Promise<void>;
}

export const EnhancedActionPanel: React.FC<EnhancedActionPanelProps> = ({
  spreadsheetId,
  token,
  scriptStatus,
  onRefreshScript
}) => {
  const [executing, setExecuting] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{isOpen: boolean, title: string, content: string | null, isHtml: boolean}>({
    isOpen: false, title: '', content: null, isHtml: false
  });
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Фильтруем функции по категории
  const filteredFunctions = scriptStatus.functions.filter(func => {
    if (filterCategory === 'all') return true;
    if (filterCategory === 'dev') return func.category === 'dev';
    return func.category !== 'dev';
  });

  // Группируем функции по меню
  const groupedFunctions = filteredFunctions.reduce((acc, func: any) => {
    if (!acc[func.menuPath]) {
      acc[func.menuPath] = [];
    }
    acc[func.menuPath].push(func);
    return acc;
  }, {} as Record<string, any[]>);

  const categories = [
    { id: 'all', label: 'Все функции', icon: '🎯' },
    { id: 'ai', label: 'AI', icon: '🤖' },
    { id: 'data', label: 'Данные', icon: '📊' },
    { id: 'settings', label: 'Настройки', icon: '⚙️' },
    { id: 'dev', label: 'Dev', icon: '🧰' }
  ];

  const handleExecute = async (func: ScriptFunction) => {
    if (!scriptStatus.scriptId || !scriptStatus.available) {
      alert('❌ Скрипт недоступен. Проверьте настройки.');
      return;
    }

    setExecuting(func.name);
    try {
      const result = await executeGoogleScript(scriptStatus.scriptId, func.name, [], token);
      const output = result.response?.result;

      if (func.returnsHtml || output && typeof output === 'object') {
        const content = output ? (typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output)) : 'Функция выполнена (нет возвращаемого значения).';
        setModalState({
          isOpen: true,
          title: func.label,
          content: content,
          isHtml: func.returnsHtml
        });
      } else {
        alert(`✅ ${func.label}: Успешно выполнено`);
      }
    } catch (e: any) {
      const errorMessage = e.message || 'Unknown error';
      
      // Даем понятное объяснение ошибки
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('Requested entity was not found')) {
        userFriendlyMessage = 'Скрипт не найден или не имеет необходимого доступа. Проверьте Script ID в настройках.';
      } else if (errorMessage.includes('403')) {
        userFriendlyMessage = 'Доступ запрещен. Убедитесь что у вас есть права на выполнение этого скрипта.';
      } else if (errorMessage.includes('Script execution failed')) {
        userFriendlyMessage = 'Ошибка выполнения скрипта. Проверьте логи в разделе Диагностика.';
      }

      alert(`❌ Ошибка выполнения "${func.label}":\n${userFriendlyMessage}`);
    } finally {
      setExecuting(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ai': return '🤖';
      case 'data': return '📊';
      case 'settings': return '⚙️';
      case 'dev': return '🧰';
      default: return '📋';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ai': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'data': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'settings': return 'bg-green-50 text-green-600 border-green-200';
      case 'dev': return 'bg-orange-50 text-orange-600 border-orange-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  if (!scriptStatus.scriptId) {
    return (
      <div className="p-4 pb-24">
        <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="font-bold text-yellow-800 mb-2">Скрипт не подключен</h3>
          <p className="text-sm text-yellow-700 mb-4">
            Для доступа к функциям Table AI необходимо найти и подключить скрипт.
          </p>
          <button
            onClick={() => onRefreshScript()}
            className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-bold"
          >
            🔍 Найти скрипт автоматически
          </button>
        </div>
      </div>
    );
  }

  if (!scriptStatus.available) {
    return (
      <div className="p-4 pb-24">
        <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h3 className="font-bold text-red-800 mb-2">Скрипт недоступен</h3>
          <p className="text-sm text-red-700 mb-4">
            {scriptStatus.error || 'Скрипт найден, но недоступен для выполнения.'}
          </p>
          <button
            onClick={() => onRefreshScript()}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold"
          >
            🔄 Проверить снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Фильтр категорий */}
      <div className="bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex gap-2 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                filterCategory === cat.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Статус */}
      <div className="bg-green-50 p-3 rounded-xl border border-green-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm font-bold text-green-800">Скрипт подключен</span>
          <span className="text-xs text-green-600 ml-auto">
            {filteredFunctions.length} функций
          </span>
        </div>
      </div>

      {/* Функции сгруппированные по меню */}
      {Object.entries(groupedFunctions).map(([menuPath, functions]: [string, any[]]) => (
        <div key={menuPath} className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            {menuPath}
          </h3>
          
          <div className="grid grid-cols-1 gap-3">
            {functions.map((func: any) => (
              <button
                key={func.name}
                onClick={() => handleExecute(func)}
                disabled={!!executing}
                className="relative flex items-center p-4 bg-white rounded-xl shadow-sm border border-slate-100 active:scale-[0.98] transition-all disabled:opacity-50 text-left group"
              >
                {/* Категория-индикатор */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${getCategoryColor(func.category).split(' ')[0]}`}></div>
                
                {/* Иконка функции */}
                <div className={`w-10 h-10 rounded-lg ${getCategoryColor(func.category)} flex items-center justify-center text-xl mr-4 shrink-0`}>
                  {getCategoryIcon(func.category)}
                </div>
                
                {/* Информация о функции */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 truncate">{func.label}</span>
                    {executing === func.name && (
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-1">{func.description}</p>
                  <div className="text-xs text-slate-400 mt-1">
                    {func.name}
                  </div>
                </div>

                {/* Hover эффект */}
                <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {filteredFunctions.length === 0 && (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-2xl mb-2">📭</div>
          <p className="text-sm text-slate-500">
            {filterCategory === 'all' 
              ? 'Нет доступных функций' 
              : `Нет функций в категории "${categories.find(c => c.id === filterCategory)?.label}"`
            }
          </p>
        </div>
      )}

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