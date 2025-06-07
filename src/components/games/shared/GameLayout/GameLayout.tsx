import React from 'react';

interface GameLayoutProps {
  title: string;
  children: React.ReactNode;
  onContainerClick?: () => void;
  className?: string;
}

export function GameLayout({
  title,
  children,
  onContainerClick,
  className = 'snake-game',
}: GameLayoutProps) {
  return (
    <div className={className} onClick={onContainerClick}>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
