/**
 * @file 日志模块，提供分级日志输出
 * @module logger
 */

/** 日志级别类型：error > warn > info > trace */
type LogLevel = 'error' | 'warn' | 'info' | 'trace';

/**
 * 日志管理器
 * 根据配置的日志级别过滤输出
 */
class Logger {
  /** 日志级别优先级映射（数值越小优先级越高） */
  private static levelOrder: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    trace: 3,
  };

  /** 当前日志级别 */
  private level: LogLevel;

  /**
   * @param level - 初始日志级别，默认 'info'
   */
  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  /**
   * 设置日志级别
   * @param level - 新的日志级别
   */
  setLevel(level: LogLevel | undefined) {
    if (!level) return;
    this.level = level;
  }

  /**
   * 判断是否应该输出指定级别的日志
   * @param level - 要判断的日志级别
   * @returns 是否应该输出
   */
  private shouldLog(level: LogLevel): boolean {
    return Logger.levelOrder[level] <= Logger.levelOrder[this.level];
  }

  /**
   * 输出错误日志
   * @param message - 日志消息
   * @param args - 额外参数
   */
  error(message: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error('[Live2D Widget][ERROR]', message, ...args);
    }
  }

  /**
   * 输出警告日志
   * @param message - 日志消息
   * @param args - 额外参数
   */
  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn('[Live2D Widget][WARN]', message, ...args);
    }
  }

  /**
   * 输出信息日志
   * @param message - 日志消息
   * @param args - 额外参数
   */
  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.log('[Live2D Widget][INFO]', message, ...args);
    }
  }

  /**
   * 输出跟踪日志
   * @param message - 日志消息
   * @param args - 额外参数
   */
  trace(message: string, ...args: any[]) {
    if (this.shouldLog('trace')) {
      console.log('[Live2D Widget][TRACE]', message, ...args);
    }
  }
}

/** 全局日志实例 */
const logger = new Logger();

export default logger;
export { LogLevel };
