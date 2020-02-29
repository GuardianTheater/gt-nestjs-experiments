import { Module, HttpModule, Logger } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { XboxService } from './xbox/xbox.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { XboxClipEntity } from './xbox/xbox-clip.entity';
import { BungieService } from './bungie/bungie.service';
import { XboxAccountEntity } from './xbox/xbox-account.entity';
import { BungieProfileEntity } from './bungie/bungie-profile.entity';
import { DestinyProfileEntity } from './bungie/destiny-profile.entity';
import { PgcrEntity } from './bungie/pgcr.entity';
import { PgcrEntryEntity } from './bungie/pgcr-entry.entity';
import { TwitchService } from './twitch/twitch.service';
import { MixerService } from './mixer/mixer.service';
import { LinksService } from './links/links.service';
import { TwitchAccountEntity } from './twitch/twitch-account.entity';
import { TwitchVideoEntity } from './twitch/twitch-video.entity';
import { MixerAccountEntity } from './mixer/mixer-account.entity';
import { MixerChannelEntity } from './mixer/mixer-channel.entity';
import { MixerRecordingEntity } from './mixer/mixer-recording.entity';
import { MixerVodEntity } from './mixer/mixer-vod.entity';
import { DestinyProfileBaseEntity } from './bungie/destiny-profile-base.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    HttpModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT, 10),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [
        XboxClipEntity,
        XboxAccountEntity,
        BungieProfileEntity,
        DestinyProfileBaseEntity,
        DestinyProfileEntity,
        PgcrEntity,
        PgcrEntryEntity,
        TwitchAccountEntity,
        TwitchVideoEntity,
        MixerAccountEntity,
        MixerChannelEntity,
        MixerRecordingEntity,
        MixerVodEntity,
      ],
      synchronize: true,
      ssl: {
        ca: process.env.DATABASE_CERT,
        rejectUnauthorized: false,
      },
    }),
    TypeOrmModule.forFeature([
      XboxClipEntity,
      XboxAccountEntity,
      BungieProfileEntity,
      DestinyProfileBaseEntity,
      DestinyProfileEntity,
      PgcrEntity,
      PgcrEntryEntity,
      TwitchAccountEntity,
      TwitchVideoEntity,
      MixerAccountEntity,
      MixerChannelEntity,
      MixerRecordingEntity,
      MixerVodEntity,
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    XboxService,
    BungieService,
    TwitchService,
    MixerService,
    LinksService,
    Logger,
  ],
})
export class AppModule {}
