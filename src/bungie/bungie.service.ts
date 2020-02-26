import { Injectable, HttpService } from '@nestjs/common';
import {
  getProfile,
  HttpClientConfig,
  DestinyComponentType,
  BungieMembershipType,
  getLinkedProfiles,
  getActivityHistory,
  getPostGameCarnageReport,
} from 'bungie-api-ts/destiny2';
import { getPartnerships, PartnershipType } from 'bungie-api-ts/user';
import { map } from 'rxjs/operators';
import { BungieProfileEntity } from './bungie-profile.entity';
import { DestinyProfileEntity } from './destiny-profile.entity';
import { XboxAccountEntity } from 'src/xbox/xbox-account.entity';
import { DestinyCharacterEntity } from './destiny-character.entity';
import { Connection, Repository, getConnection } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PgcrEntity } from './pgcr.entity';
import { PgcrEntryEntity } from './pgcr-entry.entity';

@Injectable()
export class BungieService {
  constructor(
    private readonly httpService: HttpService,
    private readonly connection: Connection,
    @InjectRepository(DestinyCharacterEntity)
    private destinyCharacterRepository: Repository<DestinyCharacterEntity>,
  ) {}

  async storeDestinyProfile(
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
      if (partnerships?.Response[0]?.partnerType === PartnershipType.Twitch) {
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
  }

  async getActivityHistoryForDestinyAccount(membershipId: string) {
    const bnetProfile = await getConnection()
      .createQueryBuilder()
      .relation(DestinyProfileEntity, 'bnetProfile')
      .of(membershipId)
      .loadOne();

    const profiles = await getConnection()
      .createQueryBuilder()
      .relation(BungieProfileEntity, 'profiles')
      .of(bnetProfile)
      .loadMany();

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const characters = await getConnection()
        .createQueryBuilder()
        .relation(DestinyProfileEntity, 'characters')
        .of(profile)
        .loadMany();

      for (let j = 0; j < characters.length; j++) {
        const character = characters[j];

        let page = 0;
        let loadMoreActivities = true;
        const dateCutOff = new Date(
          new Date().setDate(new Date().getDate() - 30),
        );
        const pgcrEntities = [];
        while (loadMoreActivities) {
          const activities = await getActivityHistory(
            config => this.bungieRequest(config),
            {
              membershipType: profile.membershipType,
              destinyMembershipId: profile.membershipId,
              characterId: character.characterId,
              count: 250,
              page,
            },
          );

          for (let k = 0; k < activities.Response.activities.length; k++) {
            const activity = activities.Response.activities[k];

            if (new Date(activity.period) < dateCutOff) {
              loadMoreActivities = false;
              break;
            }

            const pgcr = await getPostGameCarnageReport(
              config => this.bungieRequest(config),
              {
                activityId: activity.activityDetails.instanceId,
              },
            );

            const pgcrEntity = new PgcrEntity();
            pgcrEntities.push(pgcrEntity);

            pgcrEntity.instanceId = pgcr.Response.activityDetails.instanceId;
            pgcrEntity.membershipType =
              pgcr.Response.activityDetails.membershipType;
            pgcrEntity.period = pgcr.Response.period;
            pgcrEntity.entries = [];

            pgcr.Response.entries.forEach(entry => {
              const entryEntity = new PgcrEntryEntity();
              pgcrEntity.entries.push(entryEntity);

              entryEntity.profile = new DestinyProfileEntity();

              entryEntity.profile.displayName =
                entry.player.destinyUserInfo.displayName;
              entryEntity.profile.membershipId =
                entry.player.destinyUserInfo.membershipId;
              entryEntity.profile.membershipType =
                entry.player.destinyUserInfo.membershipType;

              entryEntity.fireteamId =
                entry.values.fireteamId.basic.displayValue;

              let startTime = new Date(pgcrEntity.period);
              startTime = new Date(
                startTime.setSeconds(
                  startTime.getSeconds() +
                    entry.values.startSeconds.basic.value,
                ),
              );
              let endTime = new Date(pgcrEntity.period);
              endTime = new Date(
                endTime.setSeconds(
                  endTime.getSeconds() +
                    entry.values.startSeconds.basic.value +
                    entry.values.timePlayedSeconds.basic.value,
                ),
              );

              entryEntity.timePlayedRange = `[${startTime.toISOString()}, ${endTime.toISOString()}]`;
            });
          }
          if (activities.Response.activities.length < 250) {
            loadMoreActivities = false;
          }
          page++;
        }
        await this.createPgcrs(pgcrEntities);
      }
    }
  }

  async createPgcrs(pgcrEntities: PgcrEntity[]) {
    const queryRunner = this.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (let i = 0; i < pgcrEntities.length; i++) {
        await queryRunner.manager.save(pgcrEntities[i]);
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      console.log(err);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
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
