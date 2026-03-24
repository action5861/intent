import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { DatabaseModule } from './database/database.module';
import { IntentsModule } from './intents/intents.module';
import { AiModule } from './ai/ai.module';
import { SlaModule } from './sla/sla.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { AuthRateLimitMiddleware } from './auth-rate-limit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env']
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    PrismaModule,
    RedisModule,
    DatabaseModule,
    AiModule,
    IntentsModule,
    SlaModule,
    AdminModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, RateLimitMiddleware, AuthRateLimitMiddleware],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes({ path: 'api/intents', method: RequestMethod.POST });

    consumer
      .apply(AuthRateLimitMiddleware)
      .forRoutes({ path: 'api/auth/*', method: RequestMethod.POST });
  }
}
