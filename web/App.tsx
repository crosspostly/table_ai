
import React, { useState, useEffect } from 'react';
import { AppState, DriveFile, Sheet } from './types';
import { TableList } from './components/TableList';
import { SheetViewer } from './components/SheetViewer';
import { getUserSpreadsheets, getSpreadsheetMetadata } from './services/googleSheets';
import { findScriptIdForSpreadsheet, getScriptFunctions, checkScriptAvailability, executeScriptFunction, getScriptStatus } from './services/appsScriptService';
import { getUserMe, getContent, importMockContent } from './services/apiService';

// Временной интерфейс для ScriptStatus
interface ScriptStatus {
  scriptId: string | null;
  available: boolean;
  lastChecked: string;
  searchLogs: any[];
  functions: any[];
  executionLogs: any[];
  error?: string;
}

const GOOGLE_CLIENT_ID = '1050019271136-0j14tcqn5k4flnlgj0lc6tig5kkd8vke.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email';

const App = () => {
  const [appState, setAppState] = useState<AppState>({
    token: localStorage.getItem('googleToken'),
    email: localStorage.getItem('googleEmail'),
    scriptId: null
  });

  // Состояние для SaaS
  const [saasToken, setSaasToken] = useState<string | null>(localStorage.getItem('saasToken'));
  const [saasUser, setSaasUser] = useState<any>(null);
  const [contentList, setContentList] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  const [files, setFiles] = useState<DriveFile[]>([]);
  // ... (rest of states)

  // --- SAAS AUTH CAPTURE ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      localStorage.setItem('saasToken', token);
      setSaasToken(token);
      // Очищаем URL от токена
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (saasToken && !saasUser) {
      getUserMe(saasToken)
        .then(setSaasUser)
        .catch(() => {
          localStorage.removeItem('saasToken');
          setSaasToken(null);
        });
    }
  }, [saasToken]);

  // Загрузка контента
  const fetchContent = async () => {
    if (!saasToken) return;
    setLoadingContent(true);
    try {
      const data = await getContent(saasToken);
      setContentList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingContent(false);
    }
  };

  useEffect(() => {
    if (saasToken) {
      fetchContent();
    }
  }, [saasToken]);

  const handleImportMock = async () => {
    if (!saasToken) return;
    try {
      await importMockContent(saasToken);
      fetchContent(); // Обновляем список
    } catch (e) {
      alert('Ошибка при импорте мок-данных');
    }
  };

  const handleVkLogin = () => {
    // Nginx проксирует этот запрос на воркер
    window.location.href = '/api/auth/vk/login';
  };

  const handleMockLogin = async () => {
    // Nginx проксирует этот запрос на воркер
    window.location.href = '/api/auth/mock/login';
  };

  const handleSaasLogout = () => {
    localStorage.removeItem('saasToken');
    setSaasToken(null);
    setSaasUser(null);
  };
  const [loadingFiles, setLoadingFiles] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [sheetMetadata, setSheetMetadata] = useState<Sheet[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  
  // Новое состояние для статуса скрипта
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus>({
    scriptId: null,
    available: false,
    lastChecked: '',
    searchLogs: [],
    functions: [],
    executionLogs: []
  });
  const [searchingScript, setSearchingScript] = useState(false);

  const [tokenClient, setTokenClient] = useState<any>(null);
  const [gsiLoaded, setGsiLoaded] = useState(false);

  // --- AUTH ---
  useEffect(() => {
    const initializeGsi = () => {
      // @ts-ignore
      if (window.google && window.google.accounts) {
        // @ts-ignore
        const client = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              const newToken = tokenResponse.access_token;
              localStorage.setItem('googleToken', newToken);
              
              fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                 headers: { Authorization: `Bearer ${newToken}` }
              })
              .then(res => res.json())
              .then(userInfo => {
                 const email = userInfo.email;
                 localStorage.setItem('googleEmail', email);
                 setAppState(prev => ({ ...prev, token: newToken, email: email }));
              });
              
              setAppState(prev => ({ ...prev, token: newToken }));
            }
          },
        });
        setTokenClient(client);
        setGsiLoaded(true);
      } else {
        setTimeout(initializeGsi, 500);
      }
    };
    initializeGsi();
  }, []);

  const handleAuth = () => {
    if (tokenClient) tokenClient.requestAccessToken();
  };

  const handleLogout = () => {
    localStorage.removeItem('googleToken');
    localStorage.removeItem('googleEmail');
    setAppState({ token: null, email: null, scriptId: null });
    setFiles([]);
    setSelectedFile(null);
  };

  // --- LOAD FILES ---
  useEffect(() => {
    if (appState.token && !selectedFile) {
      setLoadingFiles(true);
      getUserSpreadsheets(appState.token)
        .then(setFiles)
        .catch(e => {
          console.error(e);
          if (e.message.includes('401')) handleLogout();
        })
        .finally(() => setLoadingFiles(false));
    }
  }, [appState.token, selectedFile]);

  const handleSelectFile = async (file: DriveFile) => {
    setLoadingSheet(true);
    try {
      if (!appState.token) return;
      
      // 1. Get Metadata
      const metadata = await getSpreadsheetMetadata(file.id, appState.token);
      setSheetMetadata(metadata);
      
      // 2. Reset script status and start searching
      setScriptStatus({
        scriptId: null,
        available: false,
        lastChecked: '',
        searchLogs: [],
        functions: [],
        executionLogs: []
      });
      
      setSelectedFile(file);
      
      // 3. Автоматически ищем скрипт
      await refreshScriptStatus(file.id);

    } catch (e) {
      alert("Не удалось открыть таблицу. Проверьте права доступа.");
    } finally {
      setLoadingSheet(false);
    }
  };

  const handleUrlSubmit = (url: string) => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      handleSelectFile({ id: match[1], name: 'Таблица по ссылке', modifiedTime: new Date().toISOString(), mimeType: 'application/vnd.google-apps.spreadsheet' });
    } else {
      alert("Некорректная ссылка");
    }
  };

  // Функция для поиска и обновления статуса скрипта
  const refreshScriptStatus = async (spreadsheetId: string) => {
    if (!appState.token) return;

    setSearchingScript(true);
    try {
      // 1. Ищем Script ID
      const searchResult = await findScriptIdForSpreadsheet(spreadsheetId, appState.token);
      
      let scriptId = searchResult.scriptId;
      
      // Если не нашли, пробуем взять из localStorage
      if (!scriptId) {
        scriptId = localStorage.getItem(`scriptId_${spreadsheetId}`);
      }

      // Если нашли Script ID, проверяем доступность и функции
      let available = false;
      let functions: any[] = [];
      let error = searchResult.found ? undefined : searchResult.message;

      if (scriptId) {
        // Сохраняем в localStorage
        localStorage.setItem(`scriptId_${spreadsheetId}`, scriptId);

        // Проверяем доступность
        const availabilityResult = await checkScriptAvailability(scriptId, appState.token);
        available = availabilityResult.available;
        
        if (!availabilityResult.available) {
          error = availabilityResult.error;
        }

        // Если доступен, получаем функции
        if (available) {
          const functionsResult = await getScriptFunctions(scriptId, appState.token);
          functions = functionsResult.functions;
          if (functionsResult.error) {
            error = functionsResult.error;
          }
        }
      }

      // Обновляем статус
      const newStatus: ScriptStatus = {
        scriptId,
        available,
        lastChecked: new Date().toISOString(),
        searchLogs: searchResult.logs,
        functions,
        executionLogs: scriptStatus.executionLogs || [], // Сохраняем существующие логи выполнения
        error
      };

      setScriptStatus(newStatus);
      setAppState(prev => ({ ...prev, scriptId }));

    } catch (error: any) {
      setScriptStatus(prev => ({
        ...prev,
        available: false,
        lastChecked: new Date().toISOString(),
        error: `Ошибка обновления статуса: ${error.message}`
      }));
    } finally {
      setSearchingScript(false);
    }
  };

  const handleUpdateScriptId = (id: string) => {
    setAppState(prev => ({ ...prev, scriptId: id }));
    if (selectedFile) {
      localStorage.setItem(`scriptId_${selectedFile.id}`, id);
      // Обновляем статус если есть ID
      if (id) {
        refreshScriptStatus(selectedFile.id);
      }
    }
  };

  const handleClearLogs = () => {
    setScriptStatus(prev => ({ 
      ...prev, 
      searchLogs: [],
      executionLogs: [] 
    }));
  };

  const addExecutionLog = (functionName: string, parameters: any, success: boolean, result?: any, error?: string, executionTime?: number) => {
    const newLog = {
      id: Date.now().toString(),
      functionName,
      parameters,
      success,
      result,
      error,
      executionTime,
      timestamp: new Date().toISOString()
    };

    setScriptStatus(prev => ({
      ...prev,
      executionLogs: [newLog, ...(prev.executionLogs || [])].slice(0, 50) // Храним последние 50 логов
    }));
  };

  // --- RENDER ---

  if (!saasToken && !appState.token) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔮</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Table AI</h1>
          <p className="text-slate-500 mb-8">Умное управление таблицами</p>
          
          <div className="space-y-4">
            <button 
              onClick={handleVkLogin}
              className="w-full py-4 bg-[#0077FF] text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-3"
            >
              <img src="https://www.svgrepo.com/show/475700/vk.svg" className="w-5 h-5 bg-white rounded-full p-0.5" />
              Войти через ВКонтакте
            </button>

            <button 
              onClick={handleMockLogin}
              className="w-full py-4 bg-emerald-500 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-3"
            >
              🚀 Тестовый вход (Mock)
            </button>

            <div className="text-slate-300 text-sm">или</div>

            <button 
              onClick={handleAuth}
              disabled={!gsiLoaded}
              className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" />
              {gsiLoaded ? 'Google Sheets (Legacy)' : 'Загрузка...'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Если залогинены в SaaS, показываем SaaS интерфейс (пока заглушка)
  if (saasToken && saasUser) {
    return (
      <div className="min-h-screen bg-[#f5f7fa]">
        <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Table AI SaaS</h1>
          <div className="flex items-center gap-3">
            <img src={saasUser.avatar_url} className="w-8 h-8 rounded-full border border-slate-200" alt="Avatar" />
            <span className="text-sm font-medium text-slate-700 hidden sm:inline">{saasUser.name}</span>
            <button onClick={handleSaasLogout} className="text-slate-400 hover:text-red-500 ml-2">🚪</button>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Мой контент</h2>
            <div className="flex gap-3">
              <button 
                onClick={handleImportMock}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                📥 Импорт Mock
              </button>
              <button 
                onClick={fetchContent}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                🔄 Обновить
              </button>
            </div>
          </div>

          {loadingContent ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : contentList.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Тип</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Контент</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Дата</th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {contentList.map((item: any) => (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">
                          {item.source_type}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-slate-700 line-clamp-2 max-w-md">
                          {item.raw_text}
                        </p>
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                          Распаковать ✨
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl shadow-sm text-center border-2 border-dashed border-slate-100">
              <div className="text-4xl mb-4">Empty 📭</div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">Контент пока не загружен</h3>
              <p className="text-slate-500 mb-6 text-sm">Нажмите кнопку импорта, чтобы наполнить базу тестовыми данными.</p>
              <button 
                onClick={handleImportMock}
                className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-colors"
              >
                Загрузить тестовые посты
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedFile) {
    return (
      <SheetViewer 
        spreadsheetId={selectedFile.id}
        sheets={sheetMetadata}
        token={appState.token}
        scriptId={appState.scriptId}
        scriptStatus={scriptStatus}
        searchingScript={searchingScript}
        onUpdateScriptId={handleUpdateScriptId}
        onRefreshScript={() => refreshScriptStatus(selectedFile.id)}
        onClearLogs={handleClearLogs}
        onAddExecutionLog={addExecutionLog}
        onBack={() => setSelectedFile(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Table AI</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">{appState.email}</span>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-500">🚪</button>
        </div>
      </div>
      
      <TableList 
        files={files} 
        loading={loadingFiles} 
        onSelect={handleSelectFile}
        onUrlSubmit={handleUrlSubmit}
      />
    </div>
  );
};

export default App;
