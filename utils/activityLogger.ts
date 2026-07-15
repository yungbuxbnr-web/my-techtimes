
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const LOG_STORAGE_KEY = '@techtimes_activity_logs';
const MAX_LOGS = 2000;
const DROP_COUNT = 200;

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type LogCategory =
  | 'APP_LIFECYCLE'
  | 'AUTH'
  | 'SETUP'
  | 'NAVIGATION'
  | 'STORAGE'
  | 'NOTIFICATIONS'
  | 'WIDGET'
  | 'BACKGROUND'
  | 'IMPORT_EXPORT'
  | 'JOBS'
  | 'NETWORK'
  | 'CRASH'
  | 'GENERAL';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: string;
  sessionId: string;
}

// Generate a unique session ID once per module load
const SESSION_ID = Math.random().toString(16).slice(2, 10);

let logs: LogEntry[] = [];
let isInitialized = false;
let isInitializing = false;
let pendingEntries: LogEntry[] = [];
let initResolvers: Array<() => void> = [];
let globalHandlersInstalled = false;

// Original console methods (captured before any wrapping)
const _originalConsoleError = console.error.bind(console);
const _originalConsoleWarn = console.warn.bind(console);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function loadFromStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        logs = parsed;
      }
    }
  } catch {
    // Silently ignore — start with empty logs
    logs = [];
  }
}

async function persistToStorage(): Promise<void> {
  try {
    await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // Fire-and-forget, never throws
  }
}

async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;
  if (isInitializing) {
    // Wait for initialization via callback — no polling
    return new Promise<void>(resolve => {
      initResolvers.push(resolve);
    });
  }

  isInitializing = true;
  try {
    await loadFromStorage();
  } finally {
    isInitialized = true;
    isInitializing = false;
    // Flush pending entries
    if (pendingEntries.length > 0) {
      logs.push(...pendingEntries);
      pendingEntries = [];
      trimIfNeeded();
      persistToStorage();
    }
    // Resolve all waiters
    const resolvers = initResolvers.splice(0);
    for (const resolve of resolvers) resolve();
  }
}

function trimIfNeeded(): void {
  if (logs.length > MAX_LOGS) {
    logs.splice(0, DROP_COUNT);
  }
}

function buildEntry(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: unknown
): LogEntry {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data: data !== undefined ? JSON.stringify(data) : undefined,
    sessionId: SESSION_ID,
  };
}

function appendEntry(entry: LogEntry): void {
  if (!isInitialized) {
    pendingEntries.push(entry);
    // Kick off initialization if not already started
    if (!isInitializing) {
      ensureInitialized().catch(() => {});
    }
    return;
  }

  logs.push(entry);
  trimIfNeeded();
  // Fire-and-forget persist
  persistToStorage().catch(() => {});
}

// ─── Core log method ────────────────────────────────────────────────────────

function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: unknown
): void {
  try {
    const entry = buildEntry(level, category, message, data);
    appendEntry(entry);
  } catch {
    // Never throw
  }
}

// ─── Convenience methods ─────────────────────────────────────────────────────

function debug(category: LogCategory, message: string, data?: unknown): void {
  log('DEBUG', category, message, data);
}

function info(category: LogCategory, message: string, data?: unknown): void {
  log('INFO', category, message, data);
}

function warn(category: LogCategory, message: string, data?: unknown): void {
  log('WARN', category, message, data);
}

function error(category: LogCategory, message: string, data?: unknown): void {
  log('ERROR', category, message, data);
}

function fatal(category: LogCategory, message: string, data?: unknown): void {
  log('FATAL', category, message, data);
}

// ─── Query ───────────────────────────────────────────────────────────────────

function getLogs(filter?: {
  level?: LogLevel;
  category?: LogCategory;
  sessionId?: string;
  search?: string;
}): LogEntry[] {
  try {
    let result = [...logs];

    if (filter?.level) {
      result = result.filter(e => e.level === filter.level);
    }
    if (filter?.category) {
      result = result.filter(e => e.category === filter.category);
    }
    if (filter?.sessionId) {
      result = result.filter(e => e.sessionId === filter.sessionId);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        e =>
          e.message.toLowerCase().includes(q) ||
          (e.data && e.data.toLowerCase().includes(q))
      );
    }

    // Newest first
    return result.reverse();
  } catch {
    return [];
  }
}

// ─── Clear ───────────────────────────────────────────────────────────────────

async function clearLogs(): Promise<void> {
  try {
    logs = [];
    pendingEntries = [];
    await AsyncStorage.removeItem(LOG_STORAGE_KEY);
  } catch {
    // Never throw
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

async function exportLogs(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      warn('GENERAL', 'exportLogs: sharing not supported on web');
      return;
    }

    const allLogs = [...logs].reverse(); // oldest first for readability
    const lines = allLogs.map(e => {
      const dataStr = e.data ? `  ${e.data}` : '';
      return `[${e.timestamp}] [${e.level}] [${e.category}] sessionId=${e.sessionId}  ${e.message}${dataStr}`;
    });

    const content = lines.join('\n');
    const fileName = `techtimes-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/plain',
        dialogTitle: 'Export TechTimes Activity Logs',
      });
    } else {
      warn('GENERAL', 'exportLogs: sharing not available on this device');
    }
  } catch (e) {
    // Never throw
    _originalConsoleError('activityLogger.exportLogs error:', e);
  }
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function getStats(): {
  total: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<LogCategory, number>;
  sessionId: string;
  oldestEntry: LogEntry | null;
  newestEntry: LogEntry | null;
} {
  try {
    const byLevel: Record<LogLevel, number> = {
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      FATAL: 0,
    };
    const byCategory: Record<LogCategory, number> = {
      APP_LIFECYCLE: 0,
      AUTH: 0,
      SETUP: 0,
      NAVIGATION: 0,
      STORAGE: 0,
      NOTIFICATIONS: 0,
      WIDGET: 0,
      BACKGROUND: 0,
      IMPORT_EXPORT: 0,
      JOBS: 0,
      NETWORK: 0,
      CRASH: 0,
      GENERAL: 0,
    };

    for (const e of logs) {
      if (byLevel[e.level] !== undefined) byLevel[e.level]++;
      if (byCategory[e.category] !== undefined) byCategory[e.category]++;
    }

    return {
      total: logs.length,
      byLevel,
      byCategory,
      sessionId: SESSION_ID,
      oldestEntry: logs.length > 0 ? logs[0] : null,
      newestEntry: logs.length > 0 ? logs[logs.length - 1] : null,
    };
  } catch {
    return {
      total: 0,
      byLevel: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 },
      byCategory: {
        APP_LIFECYCLE: 0, AUTH: 0, SETUP: 0, NAVIGATION: 0, STORAGE: 0,
        NOTIFICATIONS: 0, WIDGET: 0, BACKGROUND: 0, IMPORT_EXPORT: 0,
        JOBS: 0, NETWORK: 0, CRASH: 0, GENERAL: 0,
      },
      sessionId: SESSION_ID,
      oldestEntry: null,
      newestEntry: null,
    };
  }
}

// ─── Global handlers ─────────────────────────────────────────────────────────

function installGlobalHandlers(): void {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  try {
    // Intercept console.error
    console.error = (...args: unknown[]) => {
      try {
        const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        log('ERROR', 'GENERAL', `[console.error] ${message}`);
      } catch {}
      _originalConsoleError(...args);
    };

    // Intercept console.warn
    console.warn = (...args: unknown[]) => {
      try {
        const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        log('WARN', 'GENERAL', `[console.warn] ${message}`);
      } catch {}
      _originalConsoleWarn(...args);
    };
  } catch {}

  try {
    // Unhandled promise rejections
    if (typeof (global as any).onunhandledrejection !== 'undefined') {
      (global as any).onunhandledrejection = (event: any) => {
        try {
          const reason = event?.reason ?? event;
          fatal('CRASH', 'Unhandled promise rejection', { reason: String(reason) });
        } catch {}
      };
    }
  } catch {}

  try {
    // React Native fatal error handler
    const ErrorUtils = (global as any).ErrorUtils;
    if (ErrorUtils && typeof ErrorUtils.setGlobalHandler === 'function') {
      const previousHandler = ErrorUtils.getGlobalHandler?.();
      ErrorUtils.setGlobalHandler((err: Error, isFatal: boolean) => {
        try {
          if (isFatal) {
            fatal('CRASH', `Fatal JS error: ${err?.message ?? String(err)}`, {
              stack: err?.stack,
              isFatal,
            });
          } else {
            error('CRASH', `JS error: ${err?.message ?? String(err)}`, {
              stack: err?.stack,
            });
          }
        } catch {}
        if (previousHandler) {
          previousHandler(err, isFatal);
        }
      });
    }
  } catch {}

  // Log that handlers are installed
  info('APP_LIFECYCLE', 'Global error handlers installed', { sessionId: SESSION_ID, platform: Platform.OS });
}

// ─── Kick off lazy init immediately on module load ───────────────────────────
ensureInitialized().catch(() => {});

// ─── Exported singleton ──────────────────────────────────────────────────────

export const activityLogger = {
  log,
  debug,
  info,
  warn,
  error,
  fatal,
  getLogs,
  clearLogs,
  exportLogs,
  getStats,
  installGlobalHandlers,
  get sessionId() {
    return SESSION_ID;
  },
};

export default activityLogger;
