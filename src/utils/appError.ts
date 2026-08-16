export class AppError extends Error {
  readonly key: string
  constructor(key: string) {
    super(key)
    this.name = 'AppError'
    this.key = key
  }
}

export const appError = (key: string) => new AppError(key)

export const formatThrownError = (error: unknown, fallbackKey: string, t: (key: string) => string) => {
  if (error instanceof AppError) return t(error.key)
  if (error instanceof Error && error.message) return error.message
  return t(fallbackKey)
}
