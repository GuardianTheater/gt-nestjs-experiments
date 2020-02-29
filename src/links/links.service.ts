import { Injectable, HttpService, Dependencies } from '@nestjs/common';
import { getRepository, getConnection, IsNull } from 'typeorm';
import { DestinyProfileEntity } from 'src/bungie/destiny-profile.entity';
import { XboxAccountEntity } from 'src/xbox/xbox-account.entity';
import { BungieMembershipType } from 'bungie-api-ts/user';
import { MixerService } from 'src/mixer/mixer.service';
import { MixerAccountEntity } from 'src/mixer/mixer-account.entity';
import { MixerChannelEntity } from 'src/mixer/mixer-channel.entity';

@Injectable()
export class LinksService {
  constructor(
    private readonly httpService: HttpService,
    private readonly mixerService: MixerService,
  ) {}

  async guessMixerLinks() {
    const profiles = await getRepository(DestinyProfileEntity).find({
      where: { mixerNameMatchChecked: IsNull() },
    });

    const searchRequests = [];

    const profileSearch = async (profile: DestinyProfileEntity) => {
      this.mixerService
        .searchUser(profile.displayName)
        .then(async res => {
          const result = res.data[0];
          profile.mixerNameMatchChecked = new Date().toISOString();
          if (result?.username === profile.displayName) {
            profile.mixerNameMatch = new MixerAccountEntity();
            profile.mixerNameMatch.username = result.username;
            profile.mixerNameMatch.id = result.id;
            profile.mixerNameMatch.channel = new MixerChannelEntity();
            profile.mixerNameMatch.channel.id = result.channel.id;
            return getRepository(MixerChannelEntity)
              .save(profile.mixerNameMatch.channel)
              .then(() =>
                getRepository(MixerAccountEntity)
                  .save(profile.mixerNameMatch)
                  .then(() => getRepository(Dependencies).save(profile)),
              );
          } else {
            return getRepository(DestinyProfileEntity).save(profile);
          }
        })
        .catch(reason => console.log(reason));
    };

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const search = profileSearch(profile);
      searchRequests.push(search);
    }
    await Promise.all(searchRequests);
  }

  async guessTwitchLinks() {
    console.log('');
  }

  async addXboxAccounts() {
    const profiles = await getConnection()
      .createQueryBuilder(DestinyProfileEntity, 'profile')
      .leftJoinAndSelect('profile.xboxNameMatch', 'xboxAccount')
      .where('profile.membershipType = :membershipType', {
        membershipType: BungieMembershipType.TigerXbox,
      })
      .getMany();

    const saves = [];

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      if (!profile.xboxNameMatch) {
        profile.xboxNameMatch = new XboxAccountEntity();
        profile.xboxNameMatch.gamertag = profile.displayName;

        const save = getRepository(XboxAccountEntity)
          .save(profile.xboxNameMatch)
          .then(() => getRepository(DestinyProfileEntity).save(profile))
          .catch(reason => console.log(reason));
        saves.push(save);
      }
    }

    await Promise.all(saves);
    console.log('saved em all');
  }
}
