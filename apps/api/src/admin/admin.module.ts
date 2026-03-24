import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './admin.guard';
import { IntentsModule } from '../intents/intents.module';

@Module({
  imports: [
    IntentsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as any },
      }),
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
