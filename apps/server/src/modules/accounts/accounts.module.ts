import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { CallsModule } from '../calls/calls.module';
import { AccountsController } from './accounts.controller';
@Module({
  imports: [PersistenceModule, AuthModule, RoomsModule, CallsModule],
  controllers: [AccountsController],
})
export class AccountsModule {}
