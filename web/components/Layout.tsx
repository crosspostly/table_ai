import React, { ReactNode } from 'react';
import { PageState } from '../types';

interface LayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  showBack?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title, 
  subtitle, 
  onBack, 
  showBack = false 
}) => {
  return (
    <div className="min-h-screen bg-[#f5f7fa] pb-16 text-[#2d3748]">
      <div className="max-w-[500px] mx-auto p-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white p-5 rounded-xl mb-6 shadow-md">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold m-0 mb-2">{title}</h1>
            {subtitle && (
              <p className="text-sm opacity-90 m-0">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Back Button */}
        {showBack && onBack && (
          <button 
            onClick={onBack}
            className="text-[#667eea] font-semibold mb-4 flex items-center hover:opacity-80 transition-opacity"
          >
            ← Назад
          </button>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
};