import React from 'react';
import { ButtonInfo } from '../types';

interface DynamicButtonProps {
  button: ButtonInfo;
  onClick: (button: ButtonInfo) => void;
  loading?: boolean;
}

export const DynamicButton: React.FC<DynamicButtonProps> = ({ 
  button, 
  onClick, 
  loading = false 
}) => {
  const handleClick = () => {
    if (!loading) {
      onClick(button);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-left"
    >
      <div className="flex items-start gap-3">
        {/* Icon or Image */}
        <div className="flex-shrink-0">
          {button.imageUrl ? (
            <img 
              src={button.imageUrl} 
              alt={button.label}
              className="w-10 h-10 rounded-lg object-cover"
              onError={(e) => {
                // Fallback to emoji if image fails
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${button.imageUrl ? 'hidden' : ''}`}>
            {button.icon || '🔘'}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">
            {button.label}
          </h3>
          
          {button.description && (
            <p className="text-xs text-gray-500 line-clamp-2">
              {button.description}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">
              {button.sheet}
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">
              {button.cell}
            </span>
            {button.category && button.category !== 'general' && (
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {button.category}
              </span>
            )}
          </div>
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="flex-shrink-0">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </button>
  );
};