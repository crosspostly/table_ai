
import React, { useState, useEffect } from 'react';
import { Sheet, Tab } from '../types';
import { TableCard } from './TableCard';
import { BottomNav } from './BottomNav';
import { ActionPanel } from './ActionPanel';
import { readSheetValues, writeCell } from '../services/googleSheets';

interface SheetViewerProps {
  spreadsheetId: string;
  sheets: Sheet[];
  token: string;
  scriptId?: string | null;
  onUpdateScriptId: (id: string) => void;
  onBack: () => void;
}

export const SheetViewer: React.FC<SheetViewerProps> = ({
  spreadsheetId,
  sheets,
  token,
  scriptId,
  onUpdateScriptId,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DATA);
  const [activeSheet, setActiveSheet] = useState<Sheet>(sheets[0]);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  const ROWS_PER_PAGE = 20;

  useEffect(() => {
    // Reset when sheet changes
    setRows([]);
    setPage(1);
    loadData(activeSheet.properties.title, 1);
  }, [activeSheet]);

  const loadData = async (sheetName: string, pageNum: number) => {
    setLoading(true);
    try {
      const startRow = (pageNum - 1) * ROWS_PER_PAGE + 1;
      const endRow = startRow + ROWS_PER_PAGE - 1;
      // Fetch A:ZZ
      const range = `A${startRow}:ZZ${endRow}`;
      
      const newValues = await readSheetValues(spreadsheetId, sheetName, range, token);
      
      if (pageNum === 1) {
        setRows(newValues);
      } else {
        setRows(prev => [...prev, ...newValues]);
      }
    } catch (error) {
      console.error(error);
      alert('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (rowIndex: number, colIndex: number, value: string) => {
    const sheetName = activeSheet.properties.title;
    
    const newRows = [...rows];
    // Correct row mapping: rowIndex is the index in the `rows` array
    if (!newRows[rowIndex]) newRows[rowIndex] = [];
    const oldValue = newRows[rowIndex][colIndex];
    newRows[rowIndex][colIndex] = value;
    setRows(newRows);

    try {
      // Calculate real spreadsheet row number (1-based)
      // `rowIndex` passed here is the index in the filtered data rows array.
      // Wait, the TableCard passes the "display index" (1-based) which we used as row index.
      // Let's be precise:
      // If page 1 loaded 20 rows. rows[0] is header. rows[1] is row 2.
      // We need to be careful about the offset.
      
      // If we are just editing what is visible in `rows`, `rowIndex` should be the index in `rows`.
      // The `TableCard` below calls handleEdit with `actualRowIndex + 1` (which is essentially row number).
      // Let's assume handleEdit receives the index in the `rows` array to update state,
      // AND we calculate the physical row for API.
      
      // Actually, let's simplify. Passing the index in `rows` array is safer for state update.
      // Then map to physical row.
      
      // Current implementation passed `actualRowIndex + 1` which was `originalIdx + 1 + 1` = `originalIdx + 2`.
      // But `rows` includes header at 0. So data starts at 1.
      // If `rows` has [Header, Row2, Row3...].
      // User clicks Row2. `originalIdx` (in filteredRows) is 0.
      // `rows` index is 1.
      // Physical row is 2.
      
      const physicalRow = rowIndex + 1; // Because rows[0] is A1 (Row 1). rows[1] is A2 (Row 2).

      // Calculate Column Letter
      let letter = '';
      let temp = colIndex;
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      
      const cellAddress = `${letter}${physicalRow}`;
      await writeCell(spreadsheetId, sheetName, cellAddress, value, token);
    } catch (e) {
      alert('Ошибка сохранения');
      const revert = [...rows];
      revert[rowIndex][colIndex] = oldValue;
      setRows(revert);
    }
  };

  // Filter Logic
  const headers = rows.length > 0 ? rows[0] : [];
  const dataRows = rows.slice(1);
  
  const filteredRows = dataRows.filter(row => 
    row.some(cell => cell && cell.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderContent = () => {
    if (activeTab === Tab.ACTIONS) {
      return (
        <ActionPanel 
          spreadsheetId={spreadsheetId} 
          token={token} 
          scriptId={scriptId}
          onUpdateScriptId={onUpdateScriptId}
        />
      );
    }
    
    if (activeTab === Tab.SETTINGS) {
       return (
         <div className="p-4 space-y-4">
            <h2 className="font-bold text-xl text-slate-800">Настройки</h2>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
               <label className="text-xs text-slate-500 uppercase font-bold">Script ID</label>
               <input 
                 value={scriptId || ''} 
                 onChange={(e) => onUpdateScriptId(e.target.value)}
                 className="w-full mt-2 p-3 bg-slate-50 rounded-lg text-sm font-mono border border-slate-200"
                 placeholder="ID скрипта для кнопок"
               />
               <p className="text-[10px] text-slate-400 mt-2">
                 Требуется для работы кнопок на вкладке Действия.
               </p>
            </div>
            
            <button 
              onClick={onBack}
              className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl"
            >
              Закрыть таблицу
            </button>
         </div>
       );
    }

    // DATA TAB
    return (
      <div className="flex flex-col h-full">
        {/* Sub-Header: Search & Sheets */}
        <div className="bg-white border-b border-slate-100 z-10 sticky top-0">
           {/* Sheets Tabs */}
           <div className="flex overflow-x-auto px-2 pt-2 hide-scrollbar gap-2">
            {sheets.map(sheet => (
              <button
                key={sheet.properties.sheetId}
                onClick={() => setActiveSheet(sheet)}
                className={`px-3 py-2 whitespace-nowrap text-xs font-bold rounded-t-lg transition-colors ${
                  activeSheet.properties.sheetId === sheet.properties.sheetId
                    ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-slate-500'
                }`}
              >
                {sheet.properties.title}
              </button>
            ))}
          </div>
          
          {/* Search Bar */}
          <div className="p-2">
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Поиск..."
              className="w-full bg-slate-100 border-none rounded-lg py-2 px-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24">
          {loading && rows.length === 0 && (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          )}

          {filteredRows.length > 0 ? (
            <>
              {filteredRows.map((row, idx) => {
                 // originalIdx is the index in `dataRows` (which excludes header)
                 const originalIdx = dataRows.indexOf(row);
                 // Index in `rows` array (which includes header at 0)
                 const rowsArrayIndex = originalIdx + 1;
                 
                 return (
                  <TableCard 
                    key={idx} 
                    row={row} 
                    rowIndex={rowsArrayIndex} // Pass index for display (e.g. "Row 2")
                    headers={headers}
                    onEdit={(c, v) => handleEdit(rowsArrayIndex, c, v)}
                  />
                 );
              })}
              
              {!searchQuery && (
                <button 
                  onClick={() => {
                    setPage(p => p + 1);
                    loadData(activeSheet.properties.title, page + 1);
                  }}
                  disabled={loading}
                  className="w-full py-4 bg-white border border-indigo-100 text-indigo-600 font-bold rounded-xl shadow-sm mt-4 active:bg-indigo-50"
                >
                  {loading ? 'Загрузка...' : 'Загрузить еще'}
                </button>
              )}
            </>
          ) : (
            !loading && <div className="text-center text-slate-400 py-10">Ничего не найдено</div>
          )}
        </div>
        
        {/* Floating Action Button (FAB) */}
        <button 
           className="fixed bottom-24 right-4 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-200 flex items-center justify-center text-2xl font-bold active:scale-90 transition-transform z-40"
           onClick={() => alert("Функция добавления строки в разработке")}
        >
          +
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f5f7fa]">
      {/* Top Navbar */}
      <div className="bg-white shadow-sm z-20 px-4 py-3 flex justify-between items-center sticky top-0">
          <button onClick={onBack} className="text-slate-400 font-bold text-sm">
            ← Назад
          </button>
          <span className="font-bold text-slate-800 truncate max-w-[200px]">
            {activeSheet.properties.title}
          </span>
          <div className="w-8"></div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {renderContent()}
      </div>
      
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};
