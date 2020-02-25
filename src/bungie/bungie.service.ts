import { Injectable, HttpService } from '@nestjs/common';
import {
  getProfile,
  HttpClientConfig,
  DestinyComponentType,
  BungieMembershipType,
  getLinkedProfiles,
  getActivityHistory,
} from 'bungie-api-ts/destiny2';
import { getPartnerships } from 'bungie-api-ts/user';
import { map } from 'rxjs/operators';

@Injectable()
export class BungieService {
  constructor(private readonly httpService: HttpService) {}

  async getDestinyProfile(membershipId: string) {
    await getLinkedProfiles(config => this.bungieRequest(config), {
      membershipId,
      membershipType: BungieMembershipType.TigerXbox,
      getAllMemberships: true,
    }).then(res => {
      console.log(res.Response);
      getPartnerships(config => this.bungieRequest(config), {
        membershipId: res?.Response?.bnetMembership?.membershipId,
      }).then(res => console.log(res));

      res.Response.profiles.forEach(profile => {
        getProfile(config => this.bungieRequest(config), {
          components: [DestinyComponentType.Characters],
          destinyMembershipId: profile.membershipId,
          membershipType: profile.membershipType,
        }).then(res => {
          Object.keys(res.Response.characters.data).forEach(key => {
            const character = res.Response.characters.data[key];
            getActivityHistory(config => this.bungieRequest(config), {
              membershipType: character.membershipType,
              destinyMembershipId: character.membershipId,
              characterId: character.characterId,
              count: 250,
            });
          });
        });
      });
    });
  }

  async bungieRequest(config: HttpClientConfig) {
    console.log(config);
    const requestConfig = {
      ...config,
      headers: {
        'X-API-Key': process.env.BUNGIE_API_KEY,
      },
    };
    return this.httpService
      .request(requestConfig)
      .pipe(map(res => res.data))
      .toPromise();
  }
}
