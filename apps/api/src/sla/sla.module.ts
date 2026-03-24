import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { UserGuard } from '../auth/user.guard';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [SlaController],
  providers: [SlaService, UserGuard],
})
export class SlaModule {}
