import React from 'react';

interface AvatarProps {
  nombre: string;
  url?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: '32px', md: '40px', lg: '56px' };
const fontSizes = { sm: '12px', md: '14px', lg: '18px' };

export function Avatar({ nombre, url, size = 'md' }: AvatarProps) {
  const dim = sizes[size];
  const initials = nombre
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (url) {
    return (
      <img
        src={url}
        alt={nombre}
        style={{ width: dim, height: dim, borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }

  return (
    <div style={{
      width: dim,
      height: dim,
      borderRadius: '50%',
      backgroundColor: '#1F6F78',
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: fontSizes[size],
      fontWeight: 600,
      lineHeight: 1,
    }}>
      {initials}
    </div>
  );
}
