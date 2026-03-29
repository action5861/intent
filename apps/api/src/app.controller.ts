import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // [배포 #5] Railway 헬스체크 엔드포인트 — Guard 없이 공개 접근
  @Get('api/health')
  healthCheck(): { status: string; timestamp: number } {
    return { status: 'ok', timestamp: Date.now() };
  }
}
