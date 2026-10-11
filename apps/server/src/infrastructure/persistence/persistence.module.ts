import { Module } from '@nestjs/common';
import { SESSION_REPOSITORY } from './session.repository';
import { PostgresRepository } from './postgres.repository';
import { FileRepository } from './file.repository';
@Module({
  providers: [
    {
      provide: SESSION_REPOSITORY,
      useFactory: () => {
        if (process.env.DATABASE_URL) return new PostgresRepository();
        if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_FILE_STORAGE === 'true')
          return new FileRepository();
        throw new Error(
          'Set DATABASE_URL to your Neon PostgreSQL connection string. For an explicit offline preview, run npm run dev:demo.',
        );
      },
    },
  ],
  exports: [SESSION_REPOSITORY],
})
export class PersistenceModule {}
