
export enum AssistantState {
  IDLE = 'IDLE',
  PERMISSIONS_ERROR = 'PERMISSIONS_ERROR',
  LISTENING = 'LISTENING',
  // FIX: Add missing PROCESSING state to the AssistantState enum.
  PROCESSING = 'PROCESSING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR',
}
