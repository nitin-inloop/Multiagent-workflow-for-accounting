export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (message = 'Resource not found') => new HttpError(404, message, 'NOT_FOUND');
export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, 'BAD_REQUEST', details);
export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, message, 'CONFLICT', details);
export const unprocessable = (message: string, details?: unknown) =>
  new HttpError(422, message, 'UNPROCESSABLE', details);
