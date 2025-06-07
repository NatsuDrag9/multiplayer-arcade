'use client';
import { redirect } from 'next/navigation';
import './SandboxClient.scss';
import { PlayPauseButton } from '@/components/buttons';
import { useState } from 'react';
import {
  ConnectionStatusCard,
  GameStatsCard,
  StatusMessageCard,
} from '@/components/cards';

function SandboxClient() {
  if (process.env.NODE_ENV !== 'development') {
    redirect('/');
  }

  const [isPaused, setIsPaused] = useState(false);

  return (
    <main className="sandbox">
      <h1 className="title heading-one sandbox__title">
        Welcome to Sandbox 🧪
      </h1>
      <h3 className="sub-title heading-three sandbox__sub-title">
        This is a dev only page to test and explore the list of components used
        in the web-app
      </h3>
      <div className="sandbox__content">
        <div className="sandbox__component">
          <h4 className="body-one sub-title">Play/Pause Button</h4>
          <PlayPauseButton
            onButtonClick={(pauseState) => {
              setIsPaused(pauseState);
            }}
            isPaused={isPaused}
          />
        </div>
        <div className="sandbox__component card">
          <h4 className="body-one sub-title">Connection Status Card</h4>
          <div className="sandbox__component--modified">
            <ConnectionStatusCard status="connecting" />
            <ConnectionStatusCard status="connected" showLatency latency={10} />
            <ConnectionStatusCard status="disconnected" />
          </div>
        </div>
        <div className="sandbox__component">
          <h4 className="body-one sub-title">Game Stats Card</h4>
          <GameStatsCard lives={3} score={100} />
        </div>
        <div className="sandbox__component card">
          <h4 className="body-one sub-title">Status Message Card</h4>
          <div className="sandbox__component--modified">
            <StatusMessageCard
              message="This is a warning message"
              type="warning"
            />
            <StatusMessageCard
              message="This is an error message"
              type="error"
            />
            <StatusMessageCard
              message="This is an information message"
              type="info"
            />
            <StatusMessageCard
              message="This is a successful message"
              type="success"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default SandboxClient;
