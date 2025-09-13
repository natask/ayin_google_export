
import React from 'react';
import { AssistantState } from '../types';

interface ActivationButtonProps {
  state: AssistantState;
  onPress: () => void;
  onRelease: () => void;
}

const CircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const MicIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m12 0v-1.5a6 6 0 0 0-12 0v1.5m6 6.75v3.75m0-15V3.75M12 12.75h.008v.008H12v-.008Z" />
    </svg>
);

const ProcessingIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);

const SpeakerIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
    </svg>
);


const getButtonStateStyle = (state: AssistantState) => {
  switch (state) {
    case AssistantState.LISTENING:
      return {
        bgColor: 'bg-red-500',
        borderColor: 'border-red-400',
        icon: <MicIcon className="w-1/2 h-1/2 text-white" />,
        animation: 'animate-pulse',
      };
    case AssistantState.PROCESSING:
       return {
        bgColor: 'bg-blue-600',
        borderColor: 'border-blue-500',
        icon: <ProcessingIcon className="w-1/2 h-1/2 text-white animate-spin" />,
        animation: '',
      };
    case AssistantState.SPEAKING:
      return {
        bgColor: 'bg-green-500',
        borderColor: 'border-green-400',
        icon: <SpeakerIcon className="w-1/2 h-1/2 text-white" />,
        animation: 'animate-pulse',
      };
    case AssistantState.ERROR:
    case AssistantState.PERMISSIONS_ERROR:
        return {
        bgColor: 'bg-yellow-600',
        borderColor: 'border-yellow-500',
        icon: <MicIcon className="w-1/2 h-1/2 text-white" />,
        animation: '',
      };
    case AssistantState.IDLE:
    default:
      return {
        bgColor: 'bg-gray-700',
        borderColor: 'border-gray-600',
        icon: <MicIcon className="w-1/2 h-1/2 text-white" />,
        animation: '',
      };
  }
};

export const ActivationButton: React.FC<ActivationButtonProps> = ({ state, onPress, onRelease }) => {
  const { bgColor, borderColor, icon, animation } = getButtonStateStyle(state);

  return (
    <button
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
      onMouseLeave={onRelease}
      aria-label="Activate Voice Assistant"
      className={`relative rounded-full w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center 
                 shadow-2xl focus:outline-none focus:ring-4 focus:ring-opacity-50 transition-transform duration-200 ease-in-out transform active:scale-95
                 ${bgColor} ${borderColor} focus:ring-blue-400`}
    >
        <div className={`absolute inset-0 border-8 rounded-full ${borderColor} ${animation}`} style={{ animationDuration: '1.5s' }}></div>
        <div className="z-10">{icon}</div>
    </button>
  );
};
