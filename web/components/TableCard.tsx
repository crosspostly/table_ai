
import React, { useState } from 'react';

interface TableCardProps {
  row: string[];
  rowIndex: number;
  headers: string[];
  onEdit: (cellIndex: number, value: string) => void;
}

export const TableCard: React.FC<TableCardProps> = ({ 
  row, 
  rowIndex, 
  headers, 
  onEdit 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Fields to show in preview (first 3 that usually contain data)
  const previewFields = row.slice(0, 3);
  const hasMore = row.length > 3;

  const handleEditStart = (idx: number, val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIndex(idx);
    setEditValue(val);
  };

  const handleSave = () => {
    if (editingIndex !== null) {
      onEdit(editingIndex, editValue);
      setEditingIndex(null);
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-3 transition-all hover:shadow-md">
      {/* Header / Preview */}
      <div 
        onClick={() => {
          setEditingIndex(null);
          setIsExpanded(!isExpanded);
        }}
        className="p-4 cursor-pointer active:bg-slate-50"
      >
        <div className="flex justify-between items-start mb-3">
           <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">
             #{rowIndex + 1}
           </span>
           {hasMore && (
             <span className="text-slate-400 text-xs transform transition-transform duration-300">
               {isExpanded ? '▲' : '▼'}
             </span>
           )}
        </div>

        {/* Preview Fields */}
        <div className="space-y-3">
          {previewFields.map((val, idx) => (
             <div key={idx} className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">
                  {headers[idx] || `Col ${idx + 1}`}
                </span>
                <span className="text-sm font-medium text-slate-800 line-clamp-2">
                  {val || '—'}
                </span>
             </div>
          ))}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50 pt-4 space-y-4 animate-fade-in">
          {row.slice(3).map((val, offset) => {
            const idx = offset + 3;
            const isEditing = editingIndex === idx;
            
            return (
              <div key={idx} className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                   {headers[idx] || `Col ${idx + 1}`}
                </span>
                
                {isEditing ? (
                  <div className="flex flex-col gap-2 mt-1">
                    <textarea 
                      className="w-full p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={2}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-2">
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleSave(); }}
                         className="flex-1 bg-indigo-600 text-white text-xs py-2 rounded-lg font-bold"
                       >
                         Сохранить
                       </button>
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                         className="flex-1 bg-white border border-slate-200 text-slate-600 text-xs py-2 rounded-lg font-bold"
                       >
                         Отмена
                       </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={(e) => handleEditStart(idx, val, e)}
                    className="text-sm text-slate-700 min-h-[24px] border-b border-transparent hover:border-indigo-200 hover:bg-white p-1 rounded transition-colors cursor-text"
                  >
                    {val || <span className="text-slate-300 italic">Пусто</span>}
                  </div>
                )}
              </div>
            );
          })}
          
          <div className="pt-2 flex justify-end">
            <button 
               onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
               className="text-xs text-indigo-600 font-bold px-3 py-2"
            >
              Свернуть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
