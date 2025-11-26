import React from 'react';

interface MenuCardProps {
  icon: string;
  title: string;
  onClick: () => void;
}

export const MenuCard: React.FC<MenuCardProps> = ({ icon, title, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white p-6 rounded-xl text-center cursor-pointer shadow-sm active:scale-95 active:bg-gray-50 transition-all border border-transparent hover:border-gray-100"
    >
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
    </div>
  );
};