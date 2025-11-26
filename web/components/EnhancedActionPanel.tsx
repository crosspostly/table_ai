import React, { useState, useEffect } from 'react';
import { ScriptStatus, ScriptFunction } from '../types';
import { executeGoogleScript } from '../services/googleSheets';
import { executeScriptFunction } from '../services/appsScriptService';
import { ResultModal } from './ResultModal';

interface EnhancedActionPanelProps {
  spreadsheetId: string;
  token: string;
  scriptStatus: ScriptStatus;
  onRefreshScript: () => Promise<void>;
  onAddExecutionLog: (functionName: string, parameters: any, success: boolean, result?: any, error?: string, executionTime?: number) => void;
}

export const EnhancedActionPanel: React.FC<EnhancedActionPanelProps> = ({
  spreadsheetId,
  token,
  scriptStatus,
  onRefreshScript,
  onAddExecutionLog
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
    const startTime = Date.now();
    
    try {
      // Собираем параметры (пока пустые, в будущем можно добавить форму)
      const parameters = {};
      
      const result = await executeScriptFunction(scriptStatus.scriptId, func.name, parameters, token);
      
      if (result.success) {
        // Логируем успешное выполнение
        onAddExecutionLog(func.name, parameters, true, result.result, undefined, result.executionTime);
        
        if (func.returnsHtml || result.result && typeof result.result === 'object') {
          const content = result.result ? (typeof result.result === 'object' ? JSON.stringify(result.result, null, 2) : String(result.result)) : 'Функция выполнена (нет возвращаемого значения).';
          setModalState({
            isOpen: true,
            title: func.label,
            content: content,
            isHtml: func.returnsHtml
          });
        } else {
          alert(`✅ ${func.label}: Успешно выполнено (${result.executionTime || 'N/A'}мс)`);
        }
      } else {
        // Логируем ошибку
        onAddExecutionLog(func.name, parameters, false, undefined, result.error, result.executionTime);
        
        // Даем понятное объяснение ошибки
        let userFriendlyMessage = result.error || 'Unknown error';
        if (result.error?.includes('Requested entity was not found')) {
          userFriendlyMessage = 'Скрипт не найден или не имеет необходимого доступа. Проверьте Script ID в настройках.';
        } else if (result.error?.includes('403')) {
          userFriendlyMessage = 'Доступ запрещен. Убедитесь что у вас есть права на выполнение этого скрипта.';
        } else if (result.error?.includes('Script execution failed')) {
          userFriendlyMessage = 'Ошибка выполнения скрипта. Проверьте логи в разделе Диагностика.';
        }

        alert(`❌ Ошибка выполнения "${func.label}":\n${userFriendlyMessage}`);
      }
    } catch (e: any) {
      // Логируем исключение
      const executionTime = Date.now() - startTime;
      onAddExecutionLog(func.name, {}, false, undefined, e.message, executionTime);
      
      const errorMessage = e.message || 'Unknown error';
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
          
          <div className="bg-yellow-100 p-4 rounded-lg text-left text-xs text-yellow-600 mb-4">
            <div className="font-bold mb-2">🔧 Как добавить Table AI в таблицу:</div>
            <ol className="list-decimal list-inside space-y-2">
              <li>Откройте таблицу на компьютере</li>
              <li>Меню → Extensions → Apps Script</li>
              <li>Создайте новый проект или вставьте код Table AI</li>
              <li>Сохраните проект (Ctrl+S)</li>
              <li>Вернитесь в мобильное приложение и нажмите "Найти скрипт"</li>
            </ol>
          </div>
          
          <button
            onClick={() => onRefreshScript()}
            className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-bold w-full"
          >
            🔍 Найти скрипт автоматически
          </button>
          
          <div className="text-xs text-yellow-500 mt-3">
            Table AI автоматически найдет скрипт и загрузит все доступные функции
          </div>
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
          
          <div className="bg-red-100 p-4 rounded-lg text-left text-xs text-red-600 mb-4">
            <div className="font-bold mb-2">🔍 Возможные причины:</div>
            <ul className="space-y-1">
              <li>🔑 Недостаточно прав доступа к скрипту</li>
              <li>🚫 Скрипт не опубликован для выполнения</li>
              <li>⏰ Временная ошибка Google Apps Script</li>
              <li>🌐 Проблемы с сетевым подключением</li>
            </ul>
          </div>
          
          <button
            onClick={() => onRefreshScript()}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold w-full"
          >
            🔄 Проверить снова
          </button>
          
          <div className="text-xs text-red-500 mt-3">
            Попробуйте повторить через несколько минут или проверьте права доступа
          </div>
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