
import React, { useState, useEffect } from 'react';
import { AppState, DriveFile, Sheet } from './types';
import { TableList } from './components/TableList';
import { SheetViewer } from './components/SheetViewer';
import { getUserSpreadsheets, getSpreadsheetMetadata, getLinkedScriptId } from './services/googleSheets';

const GOOGLE_CLIENT_ID = '1050019271136-0j14tcqn5k4flnlgj0lc6tig5kkd8vke.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email';

const App = () => {
  const [appState, setAppState] = useState<AppState>({
    token: localStorage.getItem('googleToken'),
    email: localStorage.getItem('googleEmail'),
    scriptId: null
  });

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [sheetMetadata, setSheetMetadata] = useState<Sheet[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);

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
      
      // 2. Auto-detect Script ID
      let scriptId = localStorage.getItem(`scriptId_${file.id}`);
      if (!scriptId) {
        // Try to find it via API
        scriptId = await getLinkedScriptId(file.id, appState.token);
        if (scriptId) {
          localStorage.setItem(`scriptId_${file.id}`, scriptId);
        }
      }
      
      setAppState(prev => ({ ...prev, scriptId }));
      setSelectedFile(file);

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

  const handleUpdateScriptId = (id: string) => {
    setAppState(prev => ({ ...prev, scriptId: id }));
    if (selectedFile) {
      localStorage.setItem(`scriptId_${selectedFile.id}`, id);
    }
  };

  // --- RENDER ---

  if (!appState.token) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔮</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Table AI</h1>
          <p className="text-slate-500 mb-8">Умное управление таблицами</p>
          <button 
            onClick={handleAuth}
            disabled={!gsiLoaded}
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 bg-white rounded-full p-0.5" />
            {gsiLoaded ? 'Войти через Google' : 'Загрузка...'}
          </button>
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
        onUpdateScriptId={handleUpdateScriptId}
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
