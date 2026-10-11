import 'reflect-metadata';
import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../../.env'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), quiet: true });
dotenv.config({ quiet: true });
import { ArgumentsHost, Catch, Controller, ExceptionFilter, Get, HttpException, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomsGateway } from './rooms.gateway';

@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status = error instanceof ZodError ? 400 : error instanceof HttpException ? error.getStatus() : 500;
    const message = error instanceof ZodError ? error.issues[0].message : error instanceof HttpException ? error.message : 'The server could not complete your request.';
    if (status === 500) console.error(error);
    res.status(status).json({ message });
  }
}
@Controller()
class Health { @Get('health') health() { return { status: 'ok', service: 'syncspace' }; } }
@Module({ controllers: [RoomsController, Health], providers: [RoomsService, RoomsGateway] })
class AppModule {}
async function main() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({ origin: (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',') });
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), '0.0.0.0');
}
void main();
