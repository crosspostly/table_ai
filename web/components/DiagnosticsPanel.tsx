import React, { useState } from 'react';
import { ScriptStatus } from '../types';

// Временной интерфейс для SearchScriptLog
interface SearchScriptLog {
  timestamp: string;
  action: string;
  details: string;
  success?: boolean;
  error?: string;
}

interface DiagnosticsPanelProps {
  scriptStatus: ScriptStatus;
  onRefreshScript: () => Promise<void>;
  onClearLogs: () => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  scriptStatus,
  onRefreshScript,
  onClearLogs
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshScript();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = () => {
    if (scriptStatus.available && scriptStatus.scriptId) return 'text-green-600 bg-green-50';
    if (scriptStatus.error) return 'text-red-600 bg-red-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  const getStatusText = () => {
    if (scriptStatus.available && scriptStatus.scriptId) return '✅ Скрипт подключен и доступен';
    if (scriptStatus.error) return '❌ Ошибка подключения';
    return '⚠️ Скрипт не найден';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ru-RU');
  };

  const getLogIcon = (log: SearchScriptLog) => {
    if (log.success) return '✅';
    if (log.error) return '❌';
    return 'ℹ️';
  };

  const getLogColor = (log: SearchScriptLog) => {
    if (log.success) return 'text-green-600';
    if (log.error) return 'text-red-600';
    return 'text-blue-600';
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Статус подключения */}
      <div className={`p-4 rounded-xl border ${getStatusColor()}`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold">Статус скрипта</h3>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs bg-white px-3 py-1 rounded-lg font-bold disabled:opacity-50"
          >
            {isRefreshing ? 'Обновление...' : 'Обновить'}
          </button>
        </div>
        
        <div className="space-y-2">
          <div className="text-sm font-medium">{getStatusText()}</div>
          
          {scriptStatus.scriptId && (
            <div className="text-xs font-mono bg-white p-2 rounded border">
              Script ID: {scriptStatus.scriptId}
            </div>
          )}
          
          {scriptStatus.lastChecked && (
            <div className="text-xs text-slate-500">
              Последняя проверка: {formatTimestamp(scriptStatus.lastChecked)}
            </div>
          )}
          
          {scriptStatus.error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
              {scriptStatus.error}
            </div>
          )}
        </div>
      </div>

      {/* Доступные функции */}
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <h3 className="font-bold mb-3">Доступные функции ({scriptStatus.functions.length})</h3>
        
        {scriptStatus.functions.length === 0 ? (
          <div className="text-sm text-slate-500">
            Нет доступных функций. Убедитесь что скрипт Table AI установлен и доступен.
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {scriptStatus.functions.map((func, index) => (
              <div key={index} className="text-xs p-2 bg-slate-50 rounded border border-slate-100">
                <div className="font-mono text-slate-700">{func.name}</div>
                <div className="text-slate-600">{func.label}</div>
                <div className="text-slate-500">{func.description}</div>
                <div className="text-slate-400">{func.menuPath}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Логи поиска */}
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold">Логи поиска ({scriptStatus.searchLogs.length})</h3>
          {scriptStatus.searchLogs.length > 0 && (
            <button
              onClick={onClearLogs}
              className="text-xs text-red-600 font-bold"
            >
              Очистить
            </button>
          )}
        </div>
        
        {scriptStatus.searchLogs.length === 0 ? (
          <div className="text-sm text-slate-500">
            Логи поиска отсутствуют. Нажмите "Обновить" для поиска скрипта.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {scriptStatus.searchLogs.map((log, index) => (
              <div
                key={index}
                className="text-xs p-2 bg-slate-50 rounded border border-slate-100 cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === index ? null : index)}
              >
                <div className="flex items-center gap-2">
                  <span className={getLogColor(log)}>{getLogIcon(log)}</span>
                  <span className="font-medium text-slate-700">{log.action}</span>
                  <span className="text-slate-400 text-xs">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                
                <div className="text-slate-600 mt-1">{log.details}</div>
                
                {log.error && expandedLog === index && (
                  <div className="text-red-600 mt-2 p-2 bg-red-50 rounded border border-red-200">
                    <strong>Ошибка:</strong> {log.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Инструкции */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
        <h3 className="font-bold text-blue-800 mb-2">📋 Инструкции</h3>
        <div className="text-xs text-blue-700 space-y-2">
          <div>
            <strong>Если скрипт не найден:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Откройте таблицу на компьютере</li>
              <li>Меню → Extensions → Apps Script</li>
              <li>Вставьте код Table AI</li>
              <li>Сохраните и вернитесь в мобильное приложение</li>
            </ol>
          </div>
          
          <div>
            <strong>Если ошибка доступа:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Убедитесь что вы владелец таблицы</li>
              <li>Проверьте права доступа к Apps Script</li>
              <li>Попробуйте повторный вход в Google</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};