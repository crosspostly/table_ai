import React, { useState } from 'react';
import { ScriptFunction, ExecutionLog } from '../types';
import { executeScriptFunction } from '../services/appsScriptService';

interface AIConstructorProps {
  spreadsheetId: string;
  token: string;
  scriptId: string | null;
  functions: ScriptFunction[];
  onAddExecutionLog: (functionName: string, parameters: any, success: boolean, result?: any, error?: string, executionTime?: number) => void;
}

export const AIConstructor: React.FC<AIConstructorProps> = ({
  spreadsheetId,
  token,
  scriptId,
  functions,
  onAddExecutionLog
}) => {
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<{ [key: string]: any }>({});
  const [parameters, setParameters] = useState<{ [key: string]: any }>({});

  const toggleFunction = (functionName: string) => {
    setSelectedFunctions(prev => 
      prev.includes(functionName) 
        ? prev.filter(f => f !== functionName)
        : [...prev, functionName]
    );
  };

  const updateParameter = (functionName: string, paramName: string, value: any) => {
    setParameters(prev => ({
      ...prev,
      [functionName]: {
        ...prev[functionName],
        [paramName]: value
      }
    }));
  };

  const executeSelectedFunctions = async () => {
    if (!scriptId || selectedFunctions.length === 0) return;

    for (const functionName of selectedFunctions) {
      setExecuting(functionName);
      try {
        const funcParams = parameters[functionName] || {};
        const result = await executeScriptFunction(scriptId, functionName, funcParams, token);
        
        if (result.success) {
          onAddExecutionLog(functionName, funcParams, true, result.result, undefined, result.executionTime);
          setShowResults(prev => ({
            ...prev,
            [functionName]: result.result
          }));
        } else {
          onAddExecutionLog(functionName, funcParams, false, undefined, result.error, result.executionTime);
        }
      } catch (error: any) {
        onAddExecutionLog(functionName, parameters[functionName] || {}, false, undefined, error.message);
      } finally {
        setExecuting(null);
      }
    }
  };

  const executeSingleFunction = async (functionName: string) => {
    if (!scriptId) return;

    setExecuting(functionName);
    try {
      const funcParams = parameters[functionName] || {};
      const result = await executeScriptFunction(scriptId, functionName, funcParams, token);
      
      if (result.success) {
        onAddExecutionLog(functionName, funcParams, true, result.result, undefined, result.executionTime);
        setShowResults(prev => ({
          ...prev,
          [functionName]: result.result
        }));
      } else {
        onAddExecutionLog(functionName, funcParams, false, undefined, result.error, result.executionTime);
      }
    } catch (error: any) {
      onAddExecutionLog(functionName, parameters[functionName] || {}, false, undefined, error.message);
    } finally {
      setExecuting(null);
    }
  };

  const clearSelection = () => {
    setSelectedFunctions([]);
    setShowResults({});
    setParameters({});
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

  const groupedFunctions = functions.reduce((acc, func) => {
    if (!acc[func.category]) {
      acc[func.category] = [];
    }
    acc[func.category].push(func);
    return acc;
  }, {} as Record<string, ScriptFunction[]>);

  if (!scriptId) {
    return (
      <div className="p-4 pb-24">
        <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="font-bold text-yellow-800 mb-2">Скрипт не подключен</h3>
          <p className="text-sm text-yellow-700">
            Для использования AI Constructor необходимо найти и подключить скрипт Table AI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Заголовок и управление */}
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          🎯 AI Constructor
          {selectedFunctions.length > 0 && (
            <span className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full text-xs">
              {selectedFunctions.length} выбрано
            </span>
          )}
        </h2>
        
        <div className="flex gap-2 mb-3">
          <button
            onClick={executeSelectedFunctions}
            disabled={selectedFunctions.length === 0 || !!executing}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executing ? 'Выполнение...' : `Выполнить выбранные (${selectedFunctions.length})`}
          </button>
          
          <button
            onClick={clearSelection}
            disabled={selectedFunctions.length === 0}
            className="bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Очистить выбор
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Выберите функции для выполнения или настройте параметры перед запуском.
        </div>
      </div>

      {/* Функции по категориям */}
      {Object.entries(groupedFunctions).map(([category, categoryFunctions]) => (
        <div key={category} className="bg-white p-4 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span>{getCategoryIcon(category)}</span>
            <span className="capitalize">{category}</span>
            <span className="text-xs text-slate-400">({categoryFunctions.length})</span>
          </h3>
          
          <div className="space-y-3">
            {categoryFunctions.map((func) => (
              <div 
                key={func.name} 
                className={`border rounded-lg p-3 transition-all ${
                  selectedFunctions.includes(func.name) 
                    ? 'border-indigo-300 bg-indigo-50' 
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedFunctions.includes(func.name)}
                    onChange={() => toggleFunction(func.name)}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  
                  {/* Информация о функции */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800">{func.label}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${getCategoryColor(func.category)}`}>
                        {getCategoryIcon(func.category)} {func.category}
                      </span>
                      
                      {/* Кнопка быстрого выполнения */}
                      <button
                        onClick={() => executeSingleFunction(func.name)}
                        disabled={executing === func.name}
                        className="ml-auto bg-green-600 text-white px-3 py-1 rounded text-xs font-bold disabled:opacity-50"
                      >
                        {executing === func.name ? '...' : '▶'}
                      </button>
                    </div>
                    
                    <p className="text-sm text-slate-600 mb-2">{func.description}</p>
                    <div className="text-xs text-slate-400">
                      Функция: <code className="bg-slate-100 px-1 rounded">{func.name}</code>
                      {func.menuPath && ` • ${func.menuPath}`}
                    </div>

                    {/* Параметры */}
                    {func.parameters && func.parameters.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs font-bold text-slate-700 mb-1">Параметры:</div>
                        {func.parameters.map((param) => (
                          <div key={param.name} className="flex items-center gap-2">
                            <label className="text-xs text-slate-600 min-w-[100px]">
                              {param.name}:
                            </label>
                            <input
                              type={param.type === 'number' ? 'number' : 'text'}
                              placeholder={param.description}
                              value={parameters[func.name]?.[param.name] || ''}
                              onChange={(e) => updateParameter(func.name, param.name, e.target.value)}
                              className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            {param.required && (
                              <span className="text-xs text-red-500">*</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Результат выполнения */}
                    {showResults[func.name] !== undefined && (
                      <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                        <div className="text-xs font-bold text-green-700 mb-1">Результат:</div>
                        <pre className="text-xs text-green-600 whitespace-pre-wrap">
                          {typeof showResults[func.name] === 'object' 
                            ? JSON.stringify(showResults[func.name], null, 2) 
                            : String(showResults[func.name])
                          }
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {functions.length === 0 && (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-2xl mb-2">📭</div>
          <p className="text-sm text-slate-500">
            Нет доступных функций. Убедитесь что скрипт Table AI установлен и доступен.
          </p>
        </div>
      )}
    </div>
  );
};