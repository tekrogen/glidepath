const isDev = process.env.NODE_ENV === "development";

interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

export function componentLogger(name: string): Logger {
  const prefix = `[${name}]`;

  return {
    info: (message, ...args) => {
      if (isDev) console.info(prefix, message, ...args);
    },
    warn: (message, ...args) => {
      if (isDev) console.warn(prefix, message, ...args);
    },
    error: (message, ...args) => {
      console.error(prefix, message, ...args);
    },
    debug: (message, ...args) => {
      if (isDev) console.debug(prefix, message, ...args);
    },
  };
}
