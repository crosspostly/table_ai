import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PageState, AppState, Sheet, LogEntry, ButtonInfo } from './types';
import { Layout } from './components/Layout';
import { MenuCard } from './components/MenuCard';
import { DynamicMenu } from './components/DynamicMenu';
import { extractSpreadsheetId, fetchSpreadsheetMetadata, readCell, readSheetValues, writeCell } from './services/googleSheets';
import { getAppsScriptWebAppUrl, setAppsScriptWebAppUrl } from './services/appsScript';

// --- CONFIGURATION ---
const GOOGLE_CLIENT_ID = '1050019271136-0j14tcqn5k4flnlgj0lc6tig5kkd8vke.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly';

// --- HELPERS ---
const getCellAddress = (rowIndex: number, colIndex: number): string => {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return `${letter}${rowIndex + 1}`;
};

// --- COMPONENTS ---

// Mobile-friendly bottom sheet editor
const CellEditor = ({ 
  isOpen, 
  value, 
  address, 
  onClose, 
  onSave, 
  onChange 
}: { 
  isOpen: boolean; 
  value: string; 
  address: string; 
  onClose: () => void; 
  onSave: () => void; 
  onChange: (val: string) => void;
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-lg rounded-t-2xl p-4 shadow-2xl transform transition-transform animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <span className="font-bold text-gray-500 text-sm">Редактирование: <span className="text-indigo-600">{address}</span></span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">✕</button>
        </div>
        
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-32 p-3 border border-gray-300 rounded-xl text-lg mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none bg-gray-50"
          placeholder="Пустая ячейка"
        />
        
        <button 
          onClick={onSave}
          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg active:bg-indigo-700 active:scale-[0.99] transition-all text-lg"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
};

const App = () => {
  // --- STATE ---
  const [appState, setAppState] = useState<AppState>({
    token: localStorage.getItem('googleToken'),
    email: localStorage.getItem('googleEmail'),
    spreadsheetId: localStorage.getItem('spreadsheetId'),
    sheets: [],
    currentSheetName: null,
    webAppUrl: localStorage.getItem('webAppUrl') || undefined
  });

  const [page, setPage] = useState<PageState>(PageState.LOGIN);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // View/Edit State
  const [gridData, setGridData] = useState<string[][]>([]);
  const [editingCell, setEditingCell] = useState<{r: number, c: number} | null>(null);
  const [editValue, setEditValue] = useState('');

  // Config State
  const [collectResult, setCollectResult] = useState<{prompt: string, data: string} | null>(null);
  const [webAppUrlInput, setWebAppUrlInput] = useState('');

  // History State
  const [history, setHistory] = useState<LogEntry[]>([]);

  // --- EFFECTS ---

  useEffect(() => {
    const savedHistory = localStorage.getItem('tableAiHistory');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tableAiHistory', JSON.stringify(history));
  }, [history]);

  // Initial Route Logic
  useEffect(() => {
    // Check Auth
    if (appState.token && appState.email) {
      if (appState.spreadsheetId) {
        if (appState.sheets.length === 0) {
           loadSpreadsheet(appState.spreadsheetId, appState.token);
        } else {
           setPage(PageState.MENU);
        }
      } else {
        setPage(PageState.ENTER_URL);
      }
    } else {
      setPage(PageState.LOGIN);
    }
  }, [appState.token, appState.spreadsheetId]);

  // --- AUTH ---
  
  const handleAuthClick = () => {
    try {
      // @ts-ignore
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            const newToken = tokenResponse.access_token;
            // Get Email for UI
            fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
               headers: { Authorization: `Bearer ${newToken}` }
            })
            .then(res => res.json())
            .then(userInfo => {
               const email = userInfo.email;
               localStorage.setItem('googleToken', newToken);
               localStorage.setItem('googleEmail', email);
               setAppState(prev => ({ ...prev, token: newToken, email: email }));
            })
            .catch(() => {
                // If user info fails, still proceed with token
                setAppState(prev => ({ ...prev, token: newToken, email: 'User' }));
            });
          }
        },
        error_callback: (err: any) => {
          console.error("Auth error:", err);
          if (err.type !== 'popup_closed') {
             alert(`Ошибка авторизации: ${err.message}`);
          }
        }
      });
      client.requestAccessToken();
    } catch (e: any) {
      alert("Ошибка Google Sign-In: " + e.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('googleToken');
    localStorage.removeItem('googleEmail');
    localStorage.removeItem('spreadsheetId');
    setAppState({
      token: null,
      email: null,
      spreadsheetId: null,
      sheets: [],
      currentSheetName: null
    });
    setPage(PageState.LOGIN);
  };

  // --- LOGIC ---

  const addLog = (action: string, details: string, sheetName?: string, cellAddress?: string, oldValue?: string, newValue?: string) => {
    const newEntry: LogEntry = {
      id: Date.now().toString() + Math.random().toString().slice(2, 5),
      timestamp: Date.now(),
      action,
      details,
      sheetName,
      cellAddress,
      oldValue,
      newValue
    };
    setHistory(prev => [newEntry, ...prev]);
  };

  const loadSpreadsheet = useCallback(async (id: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchSpreadsheetMetadata(id, token);
      const webAppUrl = getAppsScriptWebAppUrl(id);
      
      setAppState(prev => ({
        ...prev,
        sheets,
        currentSheetName: sheets.length > 0 ? sheets[0].properties.title : null,
        webAppUrl
      }));
      
      // Save webAppUrl to localStorage
      if (webAppUrl) {
        localStorage.setItem('webAppUrl', webAppUrl);
      }
      
      setPage(PageState.MENU);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || 'Unknown error';
      setError(errorMessage);
      
      if (errorMessage.includes('401') || errorMessage.includes('403')) {
         alert('Сессия истекла или нет доступа. Пожалуйста, войдите снова.');
         handleLogout();
      } else {
         alert('Ошибка загрузки таблицы: ' + errorMessage);
         setPage(PageState.ENTER_URL); // Go back to url entry on bad ID
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSheetData = async (sheetName: string) => {
    if (!appState.token || !appState.spreadsheetId) return;
    setLoading(true);
    try {
      const values = await readSheetValues(appState.spreadsheetId, sheetName, appState.token);
      setGridData(values);
    } catch (error: any) {
      alert('Failed to load sheet data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get('url') as string;
    const id = extractSpreadsheetId(url);

    if (!id) {
      alert('❌ Неверная ссылка. Скопируйте ссылку на Google Таблицу из браузера.');
      return;
    }

    localStorage.setItem('spreadsheetId', id);
    setAppState(prev => ({ ...prev, spreadsheetId: id }));
    
    if (appState.token) {
      await loadSpreadsheet(id, appState.token);
    }
  };

  const handleQuickStart = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get('quickUrl') as string;
    
    if (!url) {
        handleAuthClick(); 
        return;
    }

    const id = extractSpreadsheetId(url);
    if (!id) {
      alert('❌ Некорректная ссылка');
      return;
    }

    localStorage.setItem('spreadsheetId', id);
    setAppState(prev => ({ ...prev, spreadsheetId: id }));

    if (!appState.token) {
      handleAuthClick();
    } else {
      loadSpreadsheet(id, appState.token);
    }
  };

  // --- EDITING ---

  const handleCellClick = (r: number, c: number, val: string) => {
    setEditingCell({ r, c });
    setEditValue(val);
  };

  const saveCell = async () => {
    if (!editingCell || !appState.token || !appState.spreadsheetId || !appState.currentSheetName) return;
    
    const { r, c } = editingCell;
    const oldValue = gridData[r] ? gridData[r][c] : '';
    const newValue = editValue;

    setEditingCell(null); // Close modal immediately

    if (oldValue === newValue) return;

    // Optimistic update
    const newData = [...gridData];
    // Ensure row exists
    if (!newData[r]) {
        for(let i=0; i<=r; i++) {
            if(!newData[i]) newData[i] = [];
        }
    }
    newData[r][c] = newValue;
    setGridData(newData);

    const address = getCellAddress(r, c);

    try {
      await writeCell(appState.spreadsheetId, appState.currentSheetName, address, newValue, appState.token);
      addLog('edit', `Edited ${address}`, appState.currentSheetName, address, oldValue, newValue);
    } catch (error) {
      alert('Failed to save cell');
      // Revert optimistic
      const revertData = [...gridData];
      if (revertData[r]) revertData[r][c] = oldValue;
      setGridData(revertData);
    }
  };

  // --- DYNAMIC MENU HANDLERS ---
  
  const handleDynamicMenuAction = (button: ButtonInfo, result: any) => {
    addLog('dynamic_action', `Executed ${button.function}`, button.sheet, button.cell, '', JSON.stringify(result));
    alert(`✅ Выполнено: ${button.label}\n\nРезультат: ${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}`);
  };

  const handleDynamicMenuError = (errorMessage: string) => {
    setError(errorMessage);
    alert(`❌ Ошибка: ${errorMessage}`);
  };

  const handleWebAppUrlSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get('webAppUrl') as string;
    
    if (!url) {
      alert('Введите URL Web App');
      return;
    }
    
    if (appState.spreadsheetId) {
      setAppsScriptWebAppUrl(appState.spreadsheetId, url);
      setAppState(prev => ({ ...prev, webAppUrl: url }));
      setWebAppUrlInput('');
      alert('✅ URL Web App сохранен');
    }
  };

  // --- RENDERERS ---

  if (page === PageState.LOGIN) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm text-center">
            <div className="mb-8">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4">
                    <span className="text-3xl">📊</span>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Table AI</h1>
                <p className="text-slate-500">Управляйте Google Таблицами<br/>удобно с телефона</p>
            </div>

            <button 
                onClick={handleAuthClick}
                className="w-full bg-white text-slate-700 font-bold py-4 px-6 rounded-xl shadow-md border border-slate-200 flex items-center justify-center gap-3 hover:bg-slate-50 active:scale-95 transition-all mb-8"
            >
                <img src="https://www.google.com/favicon.ico" alt="G" className="w-6 h-6" />
                Войти через Google
            </button>

            <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-50 text-slate-400">Быстрый старт</span></div>
            </div>

            <form onSubmit={handleQuickStart} className="flex flex-col gap-3">
                <input 
                    name="quickUrl"
                    type="text" 
                    placeholder="Вставьте ссылку на таблицу..." 
                    className="w-full p-4 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm"
                />
                <button 
                    type="submit"
                    className="w-full py-4 text-indigo-600 font-bold bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
                >
                    Открыть таблицу
                </button>
            </form>
        </div>
      </div>
    );
  }

  if (page === PageState.ENTER_URL) {
    return (
      <Layout title="Подключение" subtitle="Выберите таблицу">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="mb-6 text-center">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">🔗</div>
                <h2 className="text-lg font-bold text-slate-800">Ссылка на таблицу</h2>
                <p className="text-sm text-slate-500">Скопируйте URL из адресной строки браузера</p>
            </div>

            <form onSubmit={handleUrlSubmit} className="flex flex-col gap-4">
            <input 
                name="url"
                type="text" 
                placeholder="https://docs.google.com/..." 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                required 
            />
            <button 
                type="submit"
                disabled={loading}
                className="w-full p-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50"
            >
                {loading ? 'Проверка доступа...' : 'Подключить'}
            </button>
            </form>
        </div>
        <button onClick={handleLogout} className="mt-8 w-full text-slate-400 text-sm font-medium hover:text-slate-600">
            Выйти из аккаунта
        </button>
      </Layout>
    );
  }

  if (page === PageState.MENU) {
    return (
      <Layout title="Главное меню" subtitle={appState.currentSheetName}>
        <div className="grid grid-cols-2 gap-4">
          <MenuCard icon="🎯" title="Кнопки таблицы" onClick={() => setPage(PageState.DYNAMIC_MENU)} />
          <MenuCard icon="📄" title="Данные" onClick={() => {
            setPage(PageState.VIEW_DATA);
            if (appState.currentSheetName) fetchSheetData(appState.currentSheetName);
          }} />
          <MenuCard icon="🤖" title="AI Сборщик" onClick={() => setPage(PageState.COLLECT_CONFIG)} />
          <MenuCard icon="📋" title="История" onClick={() => setPage(PageState.LOGS)} />
          <MenuCard icon="⚙️" title="Настройки" onClick={() => setPage(PageState.SETTINGS)} />
        </div>
        
        <div className="mt-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-800 text-sm">
            <p className="font-bold mb-1">💡 Подсказка</p>
            В разделе "Кнопки таблицы" доступны все функции из вашей Google Таблицы.
        </div>
      </Layout>
    );
  }

  if (page === PageState.VIEW_DATA) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white shadow-sm z-40 px-4 py-3 flex justify-between items-center border-b border-slate-200">
            <button onClick={() => setPage(PageState.MENU)} className="text-slate-500 font-medium px-2 py-1 -ml-2">← Меню</button>
            <div className="flex-1 mx-4">
                <select 
                    value={appState.currentSheetName || ''} 
                    onChange={(e) => {
                        const newSheet = e.target.value;
                        setAppState(prev => ({ ...prev, currentSheetName: newSheet }));
                        fetchSheetData(newSheet);
                    }}
                    className="w-full py-1.5 px-3 bg-slate-100 border-none rounded-lg text-sm font-bold text-center text-slate-700 outline-none"
                >
                    {appState.sheets.map(s => (
                    <option key={s.properties.sheetId} value={s.properties.title}>{s.properties.title}</option>
                    ))}
                </select>
            </div>
            <button onClick={() => appState.currentSheetName && fetchSheetData(appState.currentSheetName)} className="text-indigo-600 font-bold p-2">
                {loading ? '...' : '↻'}
            </button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto relative bg-white">
            {loading && gridData.length === 0 ? (
                 <div className="flex h-full items-center justify-center text-slate-400">Загрузка данных...</div>
            ) : (
                <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full border-collapse table-fixed">
                        <thead className="bg-slate-100 text-xs font-bold text-slate-500 uppercase">
                            <tr>
                                <th className="w-12 py-3 px-2 border-b border-r border-slate-200 sticky left-0 top-0 z-30 bg-slate-100 text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">#</th>
                                {gridData[0] && gridData[0].map((_, idx) => (
                                    <th key={idx} className="w-32 py-3 px-2 border-b border-r border-slate-200 sticky top-0 z-20 bg-slate-100 whitespace-nowrap overflow-hidden text-ellipsis text-center">
                                        {getCellAddress(-1, idx).replace('0', '')}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100 text-sm text-slate-700">
                            {gridData.map((row, r) => (
                                <tr key={r} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-2 border-r border-slate-200 bg-slate-50 text-center font-mono text-xs text-slate-400 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        {r + 1}
                                    </td>
                                    {row.map((cell, c) => (
                                        <td 
                                            key={c} 
                                            onClick={() => handleCellClick(r, c, cell)}
                                            className="h-12 px-3 py-2 border-r border-slate-100 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] relative active:bg-indigo-50"
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="h-20"></div> {/* Bottom padding for scrolling */}
                </div>
            )}
        </div>

        {/* Floating Action Button for manual reload if stuck (optional, but good for mobile) */}
        {!editingCell && (
             <div className="absolute bottom-6 right-6 z-30 pointer-events-none">
                 {/* Can add FAB here later */}
             </div>
        )}

        {/* Editor Modal */}
        <CellEditor 
            isOpen={!!editingCell}
            value={editValue}
            address={editingCell ? getCellAddress(editingCell.r, editingCell.c) : ''}
            onClose={() => setEditingCell(null)}
            onChange={setEditValue}
            onSave={saveCell}
        />
      </div>
    );
  }

  // Fallback / Other pages
  return (
    <Layout title={page === PageState.LOGS ? "История" : "Настройки"} showBack onBack={() => setPage(PageState.MENU)}>
      {page === PageState.LOGS && (
         <div className="space-y-4">
            {history.length === 0 ? <p className="text-center text-gray-400 mt-10">История пуста</p> : 
             history.map(entry => (
                 <div key={entry.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                     <div className="flex justify-between items-center mb-2">
                         <span className={`px-2 py-1 rounded text-xs font-bold ${entry.action === 'edit' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{entry.action.toUpperCase()}</span>
                         <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                     </div>
                     <p className="text-sm text-gray-800 font-medium mb-1">{entry.details}</p>
                     {entry.oldValue && (
                         <div className="text-xs text-gray-500 bg-slate-50 p-2 rounded mt-2 flex gap-2">
                             <span className="line-through opacity-50">{entry.oldValue}</span>
                             <span>→</span>
                             <span className="font-bold text-green-600">{entry.newValue}</span>
                         </div>
                     )}
                 </div>
             ))
            }
         </div>
      )}

      {page === PageState.SETTINGS && (
          <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4">Аккаунт</h3>
                  <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                          {appState.email ? appState.email[0].toUpperCase() : '?'}
                      </div>
                      <div className="overflow-hidden">
                          <p className="text-sm font-bold text-slate-900 truncate">{appState.email}</p>
                          <p className="text-xs text-slate-500">Google Account</p>
                      </div>
                  </div>
                  <button onClick={handleLogout} className="w-full py-3 border border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50">
                      Выйти
                  </button>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">Текущая таблица</h3>
                  <p className="text-xs font-mono bg-slate-50 p-2 rounded text-slate-500 break-all mb-4">{appState.spreadsheetId}</p>
                  <button onClick={() => setPage(PageState.ENTER_URL)} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl">
                      Сменить таблицу
                  </button>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-2">Apps Script Web App</h3>
                  <p className="text-xs text-slate-500 mb-4">
                      URL для доступа к функциям таблицы. Разверните Apps Script как Web App и вставьте URL сюда.
                  </p>
                  
                  {appState.webAppUrl && appState.webAppUrl !== 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID_HERE/exec' ? (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm font-mono text-green-800 break-all">{appState.webAppUrl}</p>
                      </div>
                  ) : (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">URL не настроен</p>
                      </div>
                  )}
                  
                  <form onSubmit={handleWebAppUrlSubmit} className="space-y-3">
                      <input 
                          name="webAppUrl"
                          type="text" 
                          value={webAppUrlInput}
                          onChange={(e) => setWebAppUrlInput(e.target.value)}
                          placeholder="https://script.google.com/macros/s/..." 
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                      <button 
                          type="submit"
                          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                      >
                          Сохранить URL
                      </button>
                  </form>
              </div>
          </div>
      )}
      
      {page === PageState.COLLECT_CONFIG && (
        <div className="text-center py-10 bg-white rounded-2xl border border-slate-100">
             <div className="text-4xl mb-4">🏗</div>
             <h3 className="font-bold text-slate-800">AI Конструктор</h3>
             <p className="text-slate-500 text-sm mt-2">Функция в процессе обновления дизайна</p>
        </div>
      )}
      
      {page === PageState.DYNAMIC_MENU && appState.webAppUrl && (
        <DynamicMenu
          webAppUrl={appState.webAppUrl}
          onActionExecuted={handleDynamicMenuAction}
          onError={handleDynamicMenuError}
        />
      )}
    </Layout>
  );
};

export default App;