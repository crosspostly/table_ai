import React from 'react';
import { DriveFile } from '../types';

interface TableListProps {
  files: DriveFile[];
  onSelect: (file: DriveFile) => void;
  onUrlSubmit: (url: string) => void;
  loading: boolean;
}

export const TableList: React.FC<TableListProps> = ({ files, onSelect, onUrlSubmit, loading }) => {
  const [showUrlInput, setShowUrlInput] = React.useState(false);

  return (
    <div className="p-4 space-y-4">
       <div className="flex justify-between items-center mb-2">
         <h2 className="text-xl font-bold text-slate-800">Мои таблицы</h2>
         {loading && <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
       </div>

       {/* Search / URL Toggle */}
       <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100 flex mb-4">
          <button 
             onClick={() => setShowUrlInput(false)}
             className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!showUrlInput ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}
          >
            Список
          </button>
          <button 
             onClick={() => setShowUrlInput(true)}
             className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${showUrlInput ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}
          >
            По ссылке
          </button>
       </div>

       {showUrlInput ? (
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-fade-in">
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              onUrlSubmit(form.get('url') as string);
            }}>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ссылка на Google Таблицу</label>
              <input 
                name="url"
                type="text" 
                placeholder="https://docs.google.com/spreadsheets/d/..." 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 transition-all mb-4 text-sm"
                required 
              />
              <button 
                type="submit"
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all"
              >
                Открыть таблицу
              </button>
            </form>
         </div>
       ) : (
         <div className="space-y-3 animate-fade-in">
           {files.length === 0 && !loading && (
             <div className="text-center py-10 text-slate-400">
               Нет доступных таблиц
             </div>
           )}
           
           {files.map(file => (
             <div 
               key={file.id}
               onClick={() => onSelect(file)}
               className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:scale-[0.99] transition-all flex items-center gap-4 cursor-pointer"
             >
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0 text-2xl">
                   📊
                </div>
                <div className="flex-1 min-w-0">
                   <h3 className="font-bold text-slate-800 truncate">{file.name}</h3>
                   <p className="text-xs text-slate-400">
                     {new Date(file.modifiedTime).toLocaleDateString()}
                   </p>
                </div>
                <div className="text-slate-300">→</div>
             </div>
           ))}
         </div>
       )}
    </div>
  );
};
