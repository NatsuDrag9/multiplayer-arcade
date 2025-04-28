import { isDevMode } from './envUtils';

// Define a type for the log function parameters to allow any type of arguments
type LogArgs = unknown[];

// Helper function for logging in Dev mode
export const logInDev = (...args: LogArgs): void => {
  if (isDevMode()) {
    if (typeof window !== 'undefined') {
      // Client-side
      console.log(
        '%c∴ LOGGING IN DEV',
        'font-family: monospace; font-size: 12px; color: green;'
      );
      console.log(...args);
    } else {
      // Server-side
      console.log('∴ LOGGING IN DEV:', ...args);
    }
  }
};

export const logErrorInDev = (...args: LogArgs): void => {
  if (isDevMode()) {
    if (typeof window !== 'undefined') {
      // Client-side
      console.log(
        '%c∴ LOGGING ERROR IN DEV',
        'font-family: monospace; font-size: 12px; color: red;'
      );
      console.error(...args);
    } else {
      // Server-side
      console.error('∴ LOGGING ERROR IN DEV:', ...args);
    }
  }
};
