import { Module, HttpModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { XboxService } from './xbox/xbox.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { XboxClip } from './xbox/xbox-clip.entity';
import { BungieService } from './bungie/bungie.service';

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
      entities: [XboxClip],
      synchronize: true,
      ssl: {
        ca: process.env.DATABASE_CERT,
        rejectUnauthorized: false,
      },
    }),
    TypeOrmModule.forFeature([XboxClip]),
  ],
  controllers: [AppController],
  providers: [AppService, XboxService, BungieService],
})
export class AppModule {}
