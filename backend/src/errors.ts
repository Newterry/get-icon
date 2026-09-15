export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function publicError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError('INTERNAL_ERROR', '服务器暂时无法完成请求，请稍后重试。', 500);
}
