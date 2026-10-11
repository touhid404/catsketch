import { Controller, Headers, Inject, Param, Post } from '@nestjs/common';
import { CallsService } from './calls.service';
@Controller('sessions')
export class CallsController {
  constructor(@Inject(CallsService) private calls: CallsService) {}
  @Post(':code/call-token') token(
    @Param('code') code: string,
    @Headers('authorization') header?: string,
  ) {
    return this.calls.credentials(header?.startsWith('Bearer ') ? header.slice(7) : '', code);
  }
}
