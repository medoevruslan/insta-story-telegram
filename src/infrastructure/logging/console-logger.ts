import { Logger } from '../../application/ports/logger';

export class ConsoleLogger implements Logger {
  debug(message: string, payload?: unknown): void {
    console.debug(message, payload ?? '');
  }

  info(message: string, payload?: unknown): void {
    console.info(message, payload ?? '');
  }

  warn(message: string, payload?: unknown): void {
    console.warn(message, payload ?? '');
  }

  error(message: string, payload?: unknown): void {
    console.error(message, payload ?? '');
  }
}
