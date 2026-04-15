
import React, { useState, useEffect } from 'react';
import { AppState, DriveFile, Sheet } from './types';
import { TableList } from './components/TableList';
import { SheetViewer } from './components/SheetViewer';
import { getUserSpreadsheets, getSpreadsheetMetadata } from './services/googleSheets';
import { findScriptIdForSpreadsheet, getScriptFunctions, checkScriptAvailability, executeScriptFunction, getScriptStatus } from './services/appsScriptService';
import { getUserMe, getContent, importPosts, importManualText, analyzeBatch, getResults, getPrompts } from './services/apiService';

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
  const [resultsList, setResultsList] = useState<any[]>([]);
  const [promptsList, setPromptsList] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);

  // Параметры импорта
  const [importSource, setImportSource] = useState('vk');
  const [sourceUrl, setSourceUrl] = useState('');
  const [postCount, setPostCount] = useState(10);
  const [manualText, setManualText] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string>('manual');

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

  const fetchResults = async () => {
    if (!saasToken) return;
    try {
      const data = await getResults(saasToken);
      setResultsList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPrompts = async () => {
    if (!saasToken) return;
    try {
      const data = await getPrompts(saasToken);
      setPromptsList(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (saasToken) {
      fetchContent();
      fetchResults();
      fetchPrompts();
    }
  }, [saasToken]);

  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);

  const handleImport = async () => {
    if (!saasToken) return;
    setImporting(true);
    try {
      if (importSource === 'reviews' || importSource === 'manual') {
        if (!manualText) return;
        await importManualText(saasToken, manualText, importSource);
        setManualText('');
      } else {
        if (!sourceUrl) return;
        await importPosts(saasToken, importSource, sourceUrl, postCount);
      }
      fetchContent(); // Обновляем список
    } catch (e) {
      alert('Ошибка при импорте');
    } finally {
      setImporting(false);
    }
  };

  const toggleContentSelection = (id: string) => {
    setSelectedContentIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAnalyzeBatch = async () => {
    if (!saasToken || selectedContentIds.length === 0) return;
    setAnalyzing(true);
    try {
      await analyzeBatch(saasToken, selectedPromptId, selectedContentIds);
      fetchResults();
    } catch (e) {
      alert('Ошибка при пакетном анализе');
    } finally {
      setAnalyzing(false);
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

  // Если залогинены в SaaS, показываем SaaS интерфейс
  if (saasToken && saasUser) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="text-indigo-600">🎯</span> Table AI SaaS
          </h1>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-bold text-slate-900">{saasUser.name}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">{saasUser.role}</div>
            </div>
            <img src={saasUser.avatar_url} className="w-10 h-10 rounded-xl border-2 border-slate-100 shadow-sm" alt="Avatar" />
            <button onClick={handleSaasLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all rounded-lg">🚪</button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-6 space-y-8">
          {/* Section 1: Collector Form */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">📥 Сбор данных (Collector)</h2>
              <p className="text-sm text-slate-500">Загрузите посты для массового анализа</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Источник</label>
                <select 
                  value={importSource}
                  onChange={(e) => setImportSource(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="vk">ВКонтакте (Группа/ID)</option>
                  <option value="telegram">Telegram (Канал)</option>
                  <option value="reviews">Отзывы (Текст)</option>
                  <option value="manual">Текст (Вручную)</option>
                </select>
              </div>
              
              {(importSource === 'reviews' || importSource === 'manual') ? (
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                    {importSource === 'reviews' ? 'Вставьте текст отзывов' : 'Вставьте текст'}
                  </label>
                  <textarea 
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Каждый отзыв с новой строки или единым блоком..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                  />
                </div>
              ) : (
                <>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Ссылка или ID</label>
                    <input 
                      type="text"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="Например: durov или vk.com/group"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Кол-во постов</label>
                    <input 
                      type="number"
                      value={postCount}
                      onChange={(e) => setPostCount(Number(e.target.value))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </>
              )}
              <div className="md:col-span-4">
                <button 
                  onClick={handleImport}
                  disabled={importing || !sourceUrl}
                  className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                >
                  {importing ? '⏳ Загрузка контента...' : '🚀 Загрузить данные для анализа'}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Content List & Batch Analysis */}
          {contentList.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h2 className="text-lg font-bold text-slate-800">📊 Контент для анализа ({contentList.length})</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedContentIds(contentList.map(c => c.id))}
                    className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg"
                  >
                    Выбрать все
                  </button>
                  <button 
                    onClick={() => setSelectedContentIds([])}
                    className="text-xs font-bold text-slate-400 hover:bg-slate-50 px-3 py-1.5 rounded-lg"
                  >
                    Сбросить
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="max-h-80 overflow-y-auto p-4 space-y-2">
                  {contentList.map((item: any) => (
                    <div 
                      key={item.id}
                      onClick={() => toggleContentSelection(item.id)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                        selectedContentIds.includes(item.id) 
                          ? 'border-indigo-500 bg-indigo-50/50' 
                          : 'border-slate-50 bg-white hover:border-slate-200'
                      }`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedContentIds.includes(item.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200'
                      }`}>
                        {selectedContentIds.includes(item.id) && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">
                          {item.source_type} • {new Date(item.created_at).toLocaleDateString()}
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2">{item.raw_text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Тип анализа (Промпт)</label>
                    <select 
                      value={selectedPromptId}
                      onChange={(e) => setSelectedPromptId(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {promptsList.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      {promptsList.length === 0 && <option value="manual">Стандартный анализ</option>}
                    </select>
                  </div>
                  <button 
                    onClick={handleAnalyzeBatch}
                    disabled={analyzing || selectedContentIds.length === 0}
                    className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200"
                  >
                    {analyzing ? '🧬 Идет глубокий анализ...' : `✨ Запустить анализ (${selectedContentIds.length} объектов разом)`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Results */}
          {resultsList.length > 0 && (
            <div className="space-y-6 mt-12">
              <h2 className="text-2xl font-black text-slate-900 px-2">📓 Результаты «Распаковки»</h2>
              <div className="grid gap-6">
                {resultsList.map((res: any) => (
                  <div key={res.id} className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                       <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase">
                         Complete
                       </span>
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-xl">
                        {res.prompt_id === 'manual' ? '🎯' : '💎'}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          {res.prompt_id === 'manual' ? 'Глубокий анализ постов' : res.prompt_id}
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(res.created_at).toLocaleString()} • Обработано {JSON.parse(res.input_content_ids || '[]').length} объектов
                        </div>
                      </div>
                    </div>
                    <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                      {res.ai_response}
                    </div>
                  </div>
                ))}
              </div>
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
