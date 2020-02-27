import { Module, HttpModule } from '@nestjs/common';
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
import { DestinyCharacterEntity } from './bungie/destiny-character.entity';
import { PgcrEntity } from './bungie/pgcr.entity';
import { PgcrEntryEntity } from './bungie/pgcr-entry.entity';
import { TwitchService } from './twitch/twitch.service';
import { MixerService } from './mixer/mixer.service';

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
        DestinyProfileEntity,
        DestinyCharacterEntity,
        PgcrEntity,
        PgcrEntryEntity,
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
      DestinyProfileEntity,
      DestinyCharacterEntity,
      PgcrEntity,
      PgcrEntryEntity,
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, XboxService, BungieService, TwitchService, MixerService],
})
export class AppModule {}
