import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IntentsController } from './intents.controller';
import { IntentsService } from './intents.service';
import { IntentsGateway } from './intents.gateway';
import { UserGuard } from './user.guard';
import { AdvertiserGuard } from './advertiser.guard';
import { AiModule } from '../ai/ai.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    AiModule,
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as any },
      }),
    }),
  ],
  controllers: [IntentsController],
  providers: [IntentsService, IntentsGateway, UserGuard, AdvertiserGuard],
  exports: [IntentsService],
})
export class IntentsModule {}
