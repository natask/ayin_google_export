import React, { useRef } from 'react';
import { useVoiceAssistant } from './hooks/useVoiceAssistant';
import { StatusDisplay } from './components/StatusDisplay';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, error } = useVoiceAssistant({ videoRef });

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black text-white select-none">
      {/* Video Feed - Stretches to fill the entire screen background */}
      <video 
        ref={videoRef} 
        playsInline 
        autoPlay 
        muted 
        className="absolute inset-0 w-full h-full object-cover z-0"
        aria-hidden="true"
      ></video>

      {/* Gradient Overlay for contrast - Darkens the bottom part of the screen */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" aria-hidden="true"></div>

      {/* Controls Overlay - Positioned on top of the video and gradient */}
      <div className="relative z-20 w-full h-full flex flex-col justify-end items-center pb-12 sm:pb-16">
          <div className="w-full max-w-xl mx-auto px-4 flex flex-col items-center">
            <StatusDisplay state={state} error={error} />
            <footer className="text-gray-400 text-xs text-center pt-8">
              <p>Ayin - AI Blind Assistant</p>
              <p className="mt-1">
                  Disclaimer: This is an experimental AI assistant. Information may be inaccurate.
                  Do not rely on it for critical navigation or safety.
              </p>
            </footer>
          </div>
      </div>
    </main>
  );
}

export default App;