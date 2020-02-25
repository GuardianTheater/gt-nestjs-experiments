import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { XboxService } from './xbox/xbox.service';
import { BungieService } from './bungie/bungie.service';
import { BungieMembershipType } from 'bungie-api-ts/user';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const xboxService = app.get(XboxService);
  const bungieService = app.get(BungieService);
  // xboxService.updateClipsForGamertag('chrisfried');
  // xboxService.clipCount().then(res => console.log(res));
  // xboxService.findAll().then(res => console.log(res));
  xboxService.findAllAccounts().then(res => console.log(res));
  // bungieService.getDestinyProfile(
  //   '4611686018445133002',
  //   BungieMembershipType.TigerXbox,
  // );
}
bootstrap();
