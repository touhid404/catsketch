import { AccountsModule } from './modules/accounts/accounts.module';
import { Controller, Get, Header, Logger, Module } from '@nestjs/common';
import { RoomsModule } from './modules/rooms/rooms.module';
import { AuthModule } from './modules/auth/auth.module';
import { CallsModule } from './modules/calls/calls.module';
import { KeepAliveModule } from './modules/keep-alive/keep-alive.module';
@Controller()
class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get('health') health() {
    return { status: 'ok', service: 'catsketch' };
  }

  @Get('keep-alive')
  @Header('Cache-Control', 'no-store')
  keepAlive() {
    this.logger.log('I am alive');
    return { status: 'ok', service: 'catsketch', message: 'I am alive' };
  }
}
@Module({
  imports: [RoomsModule, CallsModule, AuthModule, AccountsModule, KeepAliveModule],
  controllers: [HealthController],
})
export class AppModule {}
