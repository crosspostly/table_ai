
import React from 'react';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string | null; // HTML string or text
  isHtml: boolean;
}

export const ResultModal: React.FC<ResultModalProps> = ({ isOpen, onClose, title, content, isHtml }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full h-[90vh] sm:h-[80vh] sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col transform transition-transform animate-slide-up">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          {isHtml && content ? (
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: content }} 
            />
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 bg-white p-4 rounded-lg border border-slate-200">
              {content || 'Выполнено успешно'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
