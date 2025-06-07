import React from 'react';
import { ConnectionStatus } from '@/definitions/connectionTypes';
import './ConnectionStatusCard.scss';

interface ConnectionStatusCardProps {
  status: ConnectionStatus;
  className?: string;
  showLatency?: boolean;
  latency?: number;
}

function ConnectionStatusCard({
  status,
  className = '',
  showLatency = false,
  latency = 0,
}: ConnectionStatusCardProps) {
  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return showLatency && latency > 0 ? `ONLINE (${latency}ms)` : 'ONLINE';
      case 'connecting':
        return 'CONNECTING';
      case 'disconnected':
        return 'OFFLINE';
      default:
        return 'UNKNOWN';
    }
  };

  return (
    <div
      className={`connection-status-card connection-status-card--${status} ${className}`}
    >
      {getStatusText()}
    </div>
  );
}

export default ConnectionStatusCard;
