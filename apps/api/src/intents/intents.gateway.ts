import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * 광고주 클라이언트(프론트엔드/대시보드)와 실시간 통신을 담당하는 WebSocket 게이트웨이
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/intents-realtime'
})
export class IntentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(IntentsGateway.name);

  // 이미 구독 중인 채널 목록 관리 (Pub/Sub 중복 리스너 방지용)
  private subscribedCategories = new Set<string>();
  private subscribedSlaChannels = new Set<string>();
  private subscribedUserChannels = new Set<string>();

  // [스케일 #5] 동시접속 카운터 및 최대 제한
  private connectedClients = 0;
  private readonly MAX_CONNECTIONS = 10000;

  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 연결 시 JWT 검증 — 광고주 또는 사용자 토큰 확인
   */
  async handleConnection(client: Socket) {
    const advertiser = this.extractAdvertiser(client);
    if (advertiser) {
      // [스케일 #5] 인증 성공 시에만 카운트 — 최대 동시접속 초과 시 차단
      if (this.connectedClients >= this.MAX_CONNECTIONS) {
        this.logger.warn(`Max connections reached (${this.MAX_CONNECTIONS}). Rejecting advertiser: ${client.id}`);
        client.emit('error', { message: '서버가 혼잡합니다. 잠시 후 다시 시도해주세요.' });
        client.disconnect();
        return;
      }
      this.connectedClients++;
      client.data.advertiser = advertiser;
      this.logger.log(`Advertiser connected: [${advertiser.company}] (${client.id})`);
      await this.subscribeToPersonalMatchChannel(client, advertiser.sub, advertiser.company);
      await this.subscribeToBudgetAlertChannel(client, advertiser.sub);
      return;
    }

    const user = this.extractUser(client);
    if (user) {
      // [스케일 #5] 인증 성공 시에만 카운트
      if (this.connectedClients >= this.MAX_CONNECTIONS) {
        this.logger.warn(`Max connections reached (${this.MAX_CONNECTIONS}). Rejecting user: ${client.id}`);
        client.emit('error', { message: '서버가 혼잡합니다. 잠시 후 다시 시도해주세요.' });
        client.disconnect();
        return;
      }
      this.connectedClients++;
      client.data.user = user;
      this.logger.log(`User connected: [${user.name}] (${client.id})`);
      await this.subscribeToUserRewardChannel(client, user.sub);
      await this.subscribeToUserMatchChannel(client, user.sub);
      return;
    }

    this.logger.warn(`Unauthorized WS connection attempt: ${client.id} — disconnecting`);
    client.emit('error', { message: '인증 토큰이 필요합니다.' });
    client.disconnect();
  }

  handleDisconnect(client: Socket) {
    // [스케일 #5] 인증 성공 후 카운트된 클라이언트만 감소
    if (client.data.advertiser || client.data.user) {
      this.connectedClients = Math.max(0, this.connectedClients - 1);
    }
    const label = client.data.advertiser?.company ?? client.data.user?.name ?? 'unknown';
    this.logger.log(`Client disconnected: [${label}] (${client.id})`);
  }

  /**
   * 클라이언트(광고주)가 특정 카테고리의 의도 상장을 실시간으로 받아보기 위해 구독 요청 시
   */
  @SubscribeMessage('subscribe_category')
  async handleSubscribeCategory(client: Socket, payload: { category: string }) {
    // 이중 인증 — handleConnection 이후에도 재확인
    if (!client.data.advertiser) {
      return { error: '인증되지 않은 연결입니다.' };
    }

    if (!payload.category) return { error: 'Category is required' };

    const { category } = payload;

    // 소켓룸(Room)에 클라이언트 합류
    client.join(category);
    this.logger.log(`Advertiser [${client.data.advertiser.company}] joined room: ${category}`);

    // 만약 Redis 측에서 아직 구독하지 않은 카테고리 채널이면 Pub/Sub Subscription 연결
    if (!this.subscribedCategories.has(category)) {
      this.subscribedCategories.add(category);

      await this.redisService.subscribeToCategory(category, (message: any) => {
        // Pub/Sub에서 메시지가 넘어오면 해당 소켓 Room에 속한 모든 사용자(광고주)에게 브로드캐스트
        this.logger.log(`Broadcasting matching opportunity for category [${category}]`);
        this.server.to(category).emit('new_intent_opportunity', message);
      });
    }

    return { success: true, message: `Subscribed to real-time events for ${category}` };
  }

  /**
   * 광고주가 자신의 SLA 완료 알림을 실시간으로 받기 위해 구독
   * 연결된 광고주의 advertiserId 기반으로 자동 채널 구독
   */
  @SubscribeMessage('subscribe_sla')
  async handleSubscribeSla(client: Socket) {
    if (!client.data.advertiser) {
      return { error: '인증되지 않은 연결입니다.' };
    }

    const advertiserId = client.data.advertiser.sub;
    const slaChannel = `sla:${advertiserId}`;
    const roomName = `sla_room:${advertiserId}`;

    client.join(roomName);
    this.logger.log(`Advertiser [${client.data.advertiser.company}] subscribed to SLA notifications`);

    if (!this.subscribedSlaChannels.has(slaChannel)) {
      this.subscribedSlaChannels.add(slaChannel);

      await this.redisService.subscribeToCategory(slaChannel, (message: any) => {
        this.logger.log(`SLA completion event for Advertiser [${advertiserId}]`);
        this.server.to(roomName).emit('sla_completed', message);
      });
    }

    return { success: true, message: 'Subscribed to SLA completion notifications' };
  }

  /**
   * 광고주 개인 AI 매칭 채널 구독 — 연결 시 자동 호출
   * Redis 채널: match:ads:{advertiserId} → 소켓 이벤트: new_intent_opportunity (matchScore 포함)
   */
  private async subscribeToPersonalMatchChannel(client: Socket, advertiserId: string, company: string) {
    const matchChannel = `match:ads:${advertiserId}`;
    const roomName = `match_room:${advertiserId}`;

    client.join(roomName);

    if (!this.subscribedSlaChannels.has(matchChannel)) {
      this.subscribedSlaChannels.add(matchChannel);

      await this.redisService.subscribeToCategory(matchChannel, (message: any) => {
        this.logger.log(`[AI Match] Delivering opportunity to advertiser [${company}] (score: ${message.matchScore})`);
        this.server.to(roomName).emit('new_intent_opportunity', message);
      });
    }

    this.logger.log(`Advertiser [${company}] subscribed to personal match channel: ${matchChannel}`);
  }

  /**
   * Authorization 헤더 또는 auth.token 핸드셰이크에서 광고주 JWT 추출 및 검증
   */
  private extractAdvertiser(client: Socket): { sub: string; company: string; email: string; category: string } | null {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return null;

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (payload.role !== 'advertiser') return null;

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * 사용자 JWT 추출 및 검증 (role 없음 = 일반 사용자)
   */
  private extractUser(client: Socket): { sub: string; name: string; email: string } | null {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return null;

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // 사용자 토큰은 role 필드 없음
      if (payload.role) return null;

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * 광고주 예산 부족 알림 채널 구독 — 연결 시 자동 호출
   */
  private async subscribeToBudgetAlertChannel(client: Socket, advertiserId: string) {
    const channel = `budget_alert:${advertiserId}`;
    const roomName = `budget_room:${advertiserId}`;

    client.join(roomName);

    if (!this.subscribedSlaChannels.has(channel)) {
      this.subscribedSlaChannels.add(channel);

      await this.redisService.subscribeToCategory(channel, (message: any) => {
        this.logger.warn(`Budget alert delivered to Advertiser [${advertiserId}] — ${message.remainingBudget}원 남음`);
        this.server.to(roomName).emit('budget_alert', message);
      });
    }
  }

  /**
   * 사용자 리워드 적립 알림 채널 구독
   */
  private async subscribeToUserRewardChannel(client: Socket, userId: string) {
    const channel = `user_reward:${userId}`;
    const roomName = `user_room:${userId}`;

    client.join(roomName);

    if (!this.subscribedUserChannels.has(channel)) {
      this.subscribedUserChannels.add(channel);

      await this.redisService.subscribeToCategory(channel, (message: any) => {
        this.logger.log(`Reward notification delivered to User [${userId}] (+${message.rewardAmount}P)`);
        this.server.to(roomName).emit('reward_updated', message);
      });
    }

    this.logger.log(`User [${userId}] subscribed to reward channel: ${channel}`);
  }

  /**
   * 사용자 의도 매칭 완료 알림 채널 구독
   */
  private async subscribeToUserMatchChannel(client: Socket, userId: string) {
    const channel = `user_match:${userId}`;
    const roomName = `user_room:${userId}`;

    client.join(roomName);

    if (!this.subscribedUserChannels.has(channel)) {
      this.subscribedUserChannels.add(channel);

      await this.redisService.subscribeToCategory(channel, (message: any) => {
        // isFallback: true → 사용자 선택 대기 이벤트, false → 자동 매칭 완료 이벤트
        const eventName = message.isFallback ? 'intent_fallback_ready' : 'intent_matched';
        this.logger.log(`Match notification delivered to User [${userId}] — intent [${message.intentId}] (${eventName})`);
        this.server.to(roomName).emit(eventName, message);
      });
    }

    this.logger.log(`User [${userId}] subscribed to match channel: ${channel}`);
  }
}
