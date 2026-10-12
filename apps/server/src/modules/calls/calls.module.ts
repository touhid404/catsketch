import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
@Module({
  imports: [RoomsModule],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
