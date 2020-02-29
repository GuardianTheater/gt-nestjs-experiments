import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { XboxService } from './xbox/xbox.service';
import { BungieService } from './bungie/bungie.service';
import { BungieMembershipType } from 'bungie-api-ts/user';
import { TwitchService } from './twitch/twitch.service';
import { MixerService } from './mixer/mixer.service';
import { LinksService } from './links/links.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const xboxService = app.get(XboxService);
  const bungieService = app.get(BungieService);
  const twitchService = app.get(TwitchService);
  const mixerService = app.get(MixerService);
  const linksService = app.get(LinksService);

  const chrisfried = '4611686018445133002';
  const Malagate = '4611686018428388819';
  const Bloomer = '4611686018438442802';

  // xboxService.updateClipsForGamertag('chrisfried');
  // xboxService.clipCount().then(res => console.log(res));
  // xboxService.findAll().then(res => console.log(res));
  // xboxService.findAllAccounts().then(res => console.log(res));
  // await bungieService.updateActivityHistoryForDestinyProfile(
  //   chrisfried,
  //   BungieMembershipType.TigerXbox,
  // );
  // await linksService.addXboxAccounts();
  // await linksService.guessMixerLinks();
  // await bungieService.addTwitchPartnerships();
  // await xboxService.updateClipsForAllAccounts();
  await bungieService
    .findAllPgcrsForProfile(chrisfried)
    .then(res => console.log(res));
  // await bungieService.findAllEncounteredPlayers(chrisfried);
  // await bungieService.findAllEncounteredClips(chrisfried);
  // await twitchService
  //   .getUsersFromLogin('realkraftyy')
  //   .then(res => console.log(res.data.data[0]));
  // await twitchService
  //   .getClips('67650991')
  //   .then(res => console.log(res.data.data));
  // await twitchService
  //   .getVideos('67650991')
  //   .then(res => console.log(res.data.data));
  // await mixerService
  //   .searchUser('TokenGaming')
  //   .then(res => console.log(res.data[0]));
  // await mixerService
  //   .getChannelRecordings(50929101)
  //   .then(res => console.log(res.data[0]));
}
bootstrap();
