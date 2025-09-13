
import React from 'react';
import { AssistantState } from '../types';

interface StatusDisplayProps {
  state: AssistantState;
  error: string;
}

const getStatusText = (state: AssistantState, error: string): string => {
  switch (state) {
    case AssistantState.IDLE:
      return "Connecting...";
    case AssistantState.LISTENING:
      return "Listening...";
    case AssistantState.SPEAKING:
      return "Speaking...";
    case AssistantState.PERMISSIONS_ERROR:
    case AssistantState.ERROR:
      return error || "An unknown error occurred.";
    default:
      return "";
  }
};

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ state, error }) => {
  const statusText = getStatusText(state, error);

  return (
    <div className="text-center p-4 w-full flex flex-col justify-center items-center min-h-[100px]">
      <p 
        className="text-2xl sm:text-3xl font-semibold text-gray-100 min-h-[40px] [text-shadow:0_2px_4px_rgba(0,0,0,0.6)]" 
        aria-live="polite"
      >
        {statusText}
      </p>
    </div>
  );
};
