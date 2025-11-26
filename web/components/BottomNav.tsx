import React from 'react';
import { Tab } from '../types';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50 flex justify-around pb-safe">
      <button 
        onClick={() => onTabChange(Tab.DATA)}
        className={`flex-1 flex flex-col items-center py-3 ${activeTab === Tab.DATA ? 'text-indigo-600' : 'text-slate-400'}`}
      >
        <span className="text-xl mb-1">📄</span>
        <span className="text-[10px] font-bold uppercase">Данные</span>
      </button>

      <button 
        onClick={() => onTabChange(Tab.ACTIONS)}
        className={`flex-1 flex flex-col items-center py-3 ${activeTab === Tab.ACTIONS ? 'text-indigo-600' : 'text-slate-400'}`}
      >
        <span className="text-xl mb-1">⚡</span>
        <span className="text-[10px] font-bold uppercase">Действия</span>
      </button>

      <button 
        onClick={() => onTabChange(Tab.AI_CONSTRUCTOR)}
        className={`flex-1 flex flex-col items-center py-3 ${activeTab === Tab.AI_CONSTRUCTOR ? 'text-indigo-600' : 'text-slate-400'}`}
      >
        <span className="text-xl mb-1">🎯</span>
        <span className="text-[10px] font-bold uppercase">AI Constructor</span>
      </button>

      <button 
        onClick={() => onTabChange(Tab.SETTINGS)}
        className={`flex-1 flex flex-col items-center py-3 ${activeTab === Tab.SETTINGS ? 'text-indigo-600' : 'text-slate-400'}`}
      >
        <span className="text-xl mb-1">⚙️</span>
        <span className="text-[10px] font-bold uppercase">Настройки</span>
      </button>
    </div>
  );
};