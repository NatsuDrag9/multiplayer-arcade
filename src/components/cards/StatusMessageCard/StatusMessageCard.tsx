import React from 'react';
import { StatusMessageType } from '@/definitions/connectionTypes';
import './StatusMessageCard.scss';

interface StatusMessageCardProps {
  type: StatusMessageType;
  message: string;
  className?: string;
}

function StatusMessageCard({
  type,
  message,
  className = '',
}: StatusMessageCardProps) {
  return (
    <div
      className={`status-message-card status-message-card--${type} ${className}`}
    >
      {message}
    </div>
  );
}

export default StatusMessageCard;
