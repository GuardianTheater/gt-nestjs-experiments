import { Injectable, HttpService } from '@nestjs/common';
import {
  getProfile,
  HttpClientConfig,
  DestinyComponentType,
  BungieMembershipType,
  getLinkedProfiles,
  getActivityHistory,
} from 'bungie-api-ts/destiny2';
import { getPartnerships, PartnershipType } from 'bungie-api-ts/user';
import { map } from 'rxjs/operators';
import { BungieProfileEntity } from './bungie-profile.entity';
import { DestinyProfileEntity } from './destiny-profile.entity';
import { XboxAccountEntity } from 'src/xbox/xbox-account.entity';
import { DestinyCharacterEntity } from './destiny-character.entity';
import { Connection } from 'typeorm';

@Injectable()
export class BungieService {
  constructor(
    private readonly httpService: HttpService,
    private readonly connection: Connection,
  ) {}

  async getDestinyProfile(
    membershipId: string,
    membershipType: BungieMembershipType,
  ) {
    const linkedProfiles = await getLinkedProfiles(
      config => this.bungieRequest(config),
      {
        membershipId,
        membershipType,
        getAllMemberships: true,
      },
    );
    let bungieProfileEntity;
    if (linkedProfiles.Response.bnetMembership.membershipId) {
      bungieProfileEntity = new BungieProfileEntity();
      bungieProfileEntity.membershipId =
        linkedProfiles.Response.bnetMembership.membershipId;
      bungieProfileEntity.membershipType =
        linkedProfiles.Response.bnetMembership.membershipType;

      const partnerships = await getPartnerships(
        config => this.bungieRequest(config),
        {
          membershipId: linkedProfiles.Response.bnetMembership.membershipId,
        },
      );
      if (partnerships.Response[0].partnerType === PartnershipType.Twitch) {
        bungieProfileEntity.twitchPartnershipIdentifier =
          partnerships.Response[0].identifier;
      }
    }
    const destinyProfileEntities = [];
    for (let i = 0; i < linkedProfiles.Response.profiles.length; i++) {
      const profile = linkedProfiles.Response.profiles[i];

      const destinyProfileEntity = new DestinyProfileEntity();
      destinyProfileEntity.bnetProfile = bungieProfileEntity;
      destinyProfileEntity.displayName = profile.displayName;
      destinyProfileEntity.membershipId = profile.membershipId;
      destinyProfileEntity.membershipType = profile.membershipType;

      if (profile.membershipType === BungieMembershipType.TigerXbox) {
        const xboxAccountEntity = new XboxAccountEntity();
        xboxAccountEntity.gamertag = profile.displayName;
        destinyProfileEntity.xboxAccount = xboxAccountEntity;
      }

      const profileWithCharacters = await getProfile(
        config => this.bungieRequest(config),
        {
          components: [DestinyComponentType.Characters],
          destinyMembershipId: profile.membershipId,
          membershipType: profile.membershipType,
        },
      );

      destinyProfileEntity.characters = [];

      for (
        let j = 0;
        j < Object.keys(profileWithCharacters.Response.characters.data).length;
        j++
      ) {
        const key = Object.keys(profileWithCharacters.Response.characters.data)[
          j
        ];
        const character = profileWithCharacters.Response.characters.data[key];

        const destinyCharacterEntity = new DestinyCharacterEntity();
        destinyCharacterEntity.characterId = character.characterId;

        destinyProfileEntity.characters.push(destinyCharacterEntity);
      }

      destinyProfileEntities.push(destinyProfileEntity);
    }
    console.log(destinyProfileEntities);
    await this.createMany(destinyProfileEntities);

    // getActivityHistory(config => this.bungieRequest(config), {
    //   membershipType: character.membershipType,
    //   destinyMembershipId: character.membershipId,
    //   characterId: character.characterId,
    //   count: 250,
    // });
  }

  async bungieRequest(config: HttpClientConfig) {
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

  async createMany(destinyProfileEntities: DestinyProfileEntity[]) {
    const queryRunner = this.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (let i = 0; i < destinyProfileEntities.length; i++) {
        await queryRunner.manager.save(destinyProfileEntities[i]);
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      console.log(err);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }
}
