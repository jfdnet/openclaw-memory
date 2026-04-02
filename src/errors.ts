export class MemoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

export class DatabaseError extends MemoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'DATABASE_ERROR', cause);
    this.name = 'DatabaseError';
  }
}

export class ParseError extends MemoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'PARSE_ERROR', cause);
    this.name = 'ParseError';
  }
}

export class ConfigError extends MemoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', cause);
    this.name = 'ConfigError';
  }
}

// 错误处理工具
export function handleError(error: unknown): MemoryError {
  if (error instanceof MemoryError) {
    return error;
  }
  
  if (error instanceof Error) {
    // 根据错误消息分类
    if (error.message.includes('SQLITE') || error.message.includes('database')) {
      return new DatabaseError(error.message, error);
    }
    if (error.message.includes('parse') || error.message.includes('syntax')) {
      return new ParseError(error.message, error);
    }
    return new MemoryError(error.message, 'UNKNOWN_ERROR', error);
  }
  
  return new MemoryError(String(error), 'UNKNOWN_ERROR');
}