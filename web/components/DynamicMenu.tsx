import React, { useState, useEffect } from 'react';
import { ButtonInfo } from '../types';
import { DynamicButton } from './DynamicButton';
import { fetchSheetButtons, callAppsScriptFunction } from '../services/appsScript';

interface DynamicMenuProps {
  webAppUrl: string;
  onActionExecuted?: (button: ButtonInfo, result: any) => void;
  onError?: (error: string) => void;
}

export const DynamicMenu: React.FC<DynamicMenuProps> = ({ 
  webAppUrl, 
  onActionExecuted,
  onError 
}) => {
  const [buttons, setButtons] = useState<ButtonInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingButton, setExecutingButton] = useState<string | null>(null);
  const [showResult, setShowResult] = useState<{ button: ButtonInfo; result: any } | null>(null);

  // Load buttons from the spreadsheet
  useEffect(() => {
    const loadButtons = async () => {
      try {
        setLoading(true);
        const fetchedButtons = await fetchSheetButtons(webAppUrl);
        setButtons(fetchedButtons);
      } catch (error) {
        console.error('Failed to load buttons:', error);
        onError?.(error instanceof Error ? error.message : 'Failed to load buttons');
      } finally {
        setLoading(false);
      }
    };

    if (webAppUrl) {
      loadButtons();
    }
  }, [webAppUrl, onError]);

  // Handle button click
  const handleButtonClick = async (button: ButtonInfo) => {
    if (!button.function) {
      onError?.('Кнопка не имеет назначенной функции');
      return;
    }

    try {
      setExecutingButton(`${button.sheet}_${button.cell}`);
      
      // Call the function through Apps Script Web App
      const result = await callAppsScriptFunction(webAppUrl, button.function);
      
      // Show the result
      setShowResult({ button, result });
      onActionExecuted?.(button, result);
      
    } catch (error) {
      console.error('Failed to execute button function:', error);
      onError?.(error instanceof Error ? error.message : `Failed to execute ${button.function}`);
    } finally {
      setExecutingButton(null);
    }
  };

  // Group buttons by category
  const groupedButtons = buttons.reduce((acc, button) => {
    const category = button.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(button);
    return acc;
  }, {} as Record<string, ButtonInfo[]>);

  // Category names in Russian
  const categoryNames: Record<string, string> = {
    general: 'Основные',
    ai: 'AI функции',
    data: 'Работа с данными',
    export: 'Экспорт',
    import: 'Импорт',
    settings: 'Настройки',
    tools: 'Инструменты'
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 text-sm">Загрузка кнопок...</p>
      </div>
    );
  }

  if (buttons.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Нет кнопок</h3>
        <p className="text-gray-500 text-sm">
          В этой таблице还没有 найдено кнопок с назначенными скриптами
        </p>
      </div>
    );
  }

  // Result modal
  if (showResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 shadow-2xl transform transition-transform">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="font-bold text-gray-900">
              {showResult.button.icon} {showResult.button.label}
            </h3>
            <button 
              onClick={() => setShowResult(null)}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              ✕
            </button>
          </div>
          
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-2">
              {showResult.button.sheet}!{showResult.button.cell}
            </div>
            
            {typeof showResult.result === 'string' ? (
              <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                {showResult.result}
              </div>
            ) : typeof showResult.result === 'object' ? (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-64">
                  {JSON.stringify(showResult.result, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                {String(showResult.result)}
              </div>
            )}
          </div>
          
          <button
            onClick={() => setShowResult(null)}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl active:bg-indigo-700 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Меню таблицы</h2>
        <p className="text-sm text-gray-500">
          {buttons.length} кноп{buttons.length === 1 ? 'ка' : buttons.length < 5 ? 'ки' : 'ок'} найдено
        </p>
      </div>

      {Object.entries(groupedButtons).map(([category, categoryButtons]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider px-1">
            {categoryNames[category] || category}
          </h3>

          <div className="space-y-2">
            {categoryButtons.map((button) => (
              <DynamicButton
                key={`${button.sheet}_${button.cell}`}
                button={button}
                onClick={handleButtonClick}
                loading={executingButton === `${button.sheet}_${button.cell}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};