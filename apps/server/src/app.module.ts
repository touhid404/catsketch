import { Controller, Get, Module } from '@nestjs/common';
import { RoomsModule } from './modules/rooms/rooms.module';
import { CallsModule } from './modules/calls/calls.module';
@Controller()
class HealthController {
  @Get('health') health() {
    return { status: 'ok', service: 'syncspace' };
  }
}
@Module({
  imports: [RoomsModule, CallsModule],
  controllers: [HealthController],
})
export class AppModule {}
