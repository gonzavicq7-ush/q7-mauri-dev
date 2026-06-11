import React from 'react';

interface TarjetaProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  padding?: 'normal' | 'none';
}

export function Tarjeta({ children, onClick, className, padding = 'normal' }: TarjetaProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        boxShadow: '0 1px 3px rgba(16,24,40,.08)',
        border: '1px solid #E3E8EA',
        padding: padding === 'none' ? 0 : '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
    >
      {children}
    </div>
  );
}
