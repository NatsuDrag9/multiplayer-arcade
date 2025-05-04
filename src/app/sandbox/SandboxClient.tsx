'use client';
import { redirect } from 'next/navigation';
import './SandboxClient.scss';
import { PlayPauseButton } from '@/components/buttons';
import { useState } from 'react';

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
      </div>
    </main>
  );
}

export default SandboxClient;
