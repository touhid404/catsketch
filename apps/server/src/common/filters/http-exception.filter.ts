import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { ZodError } from 'zod';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status =
      error instanceof ZodError ? 400 : error instanceof HttpException ? error.getStatus() : 500;
    const message =
      error instanceof ZodError
        ? error.issues[0].message
        : error instanceof HttpException
          ? error.message
          : 'The server could not complete your request.';
    if (status === 500) console.error(error);
    res.status(status).json({ message });
  }
}
