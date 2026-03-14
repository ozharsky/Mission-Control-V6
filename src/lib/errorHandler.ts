// Centralized error handling utility
import { useToastStore } from '../stores/appStore';

export const handleAsyncError = async (
  fn: () => Promise<void>,
  errorMessage: string
): Promise<void> => {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : errorMessage;
    useToastStore.getState().addToast({
      type: 'error',
      title: 'Error',
      message,
      duration: 5000,
    });
    throw error;
  }
};
