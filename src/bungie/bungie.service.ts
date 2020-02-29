import { Injectable, HttpService, Logger } from '@nestjs/common';
import {
  getProfile,
  HttpClientConfig,
  DestinyComponentType,
  BungieMembershipType,
  getLinkedProfiles,
  getActivityHistory,
  getPostGameCarnageReport,
  DestinyActivityHistoryResults,
  ServerResponse,
  DestinyHistoricalStatsPeriodGroup,
} from 'bungie-api-ts/destiny2';
import { getPartnerships, PartnershipType } from 'bungie-api-ts/user';
import { map } from 'rxjs/operators';
import { BungieProfileEntity } from './bungie-profile.entity';
import { DestinyProfileEntity } from './destiny-profile.entity';
import { getConnection, getRepository } from 'typeorm';
import { PgcrEntity } from './pgcr.entity';
import { PgcrEntryEntity } from './pgcr-entry.entity';
import upsert from 'src/helpers/typeorm-upsert';

@Injectable()
export class BungieService {
  daysOfHistory = parseInt(process.env.DAYS_OF_HISTORY, 10);

  constructor(
    private readonly httpService: HttpService,
    private readonly logger: Logger,
  ) {}

  async updateActivityHistoryForDestinyProfile(
    destinyMembershipId: string,
    membershipType: BungieMembershipType,
  ) {
    const existingActivities = await getRepository(PgcrEntryEntity).find({
      where: {
        profile: destinyMembershipId,
      },
      relations: ['instance'],
    });

    const skipActivities = new Set(
      existingActivities.map(activity => activity.instance.instanceId),
    );

    const profile = await getProfile(config => this.bungieRequest(config), {
      components: [DestinyComponentType.Profiles],
      destinyMembershipId,
      membershipType,
    })
      .then(res => res.Response.profile.data)
      .catch(e => e);

    const activities: DestinyHistoricalStatsPeriodGroup[] = [];
    const activitiesPromises = [];

    const createActivitiesPromise = async characterId => {
      let page = 0;
      let loadMoreActivities = true;
      const dateCutOff = new Date(
        new Date().setDate(new Date().getDate() - this.daysOfHistory),
      );

      while (loadMoreActivities) {
        await getActivityHistory(config => this.bungieRequest(config), {
          membershipType,
          destinyMembershipId,
          characterId,
          count: 250,
          page,
        })
          .then((res: ServerResponse<DestinyActivityHistoryResults>) => {
            for (let k = 0; k < res.Response.activities.length; k++) {
              const activity = res.Response.activities[k];

              if (new Date(activity.period) < dateCutOff) {
                loadMoreActivities = false;
                break;
              }

              if (skipActivities.has(activity.activityDetails.instanceId)) {
                continue;
              }

              activities.push(activity);
            }

            if (res.Response.activities.length < 250) {
              loadMoreActivities = false;
            }
            page++;
          })
          .catch(e => e);
      }
    };

    for (let i = 0; i < profile.characterIds.length; i++) {
      const characterId = profile.characterIds[i];

      const activitiesPromise = createActivitiesPromise(characterId);

      activitiesPromises.push(activitiesPromise);
    }

    this.logger.log('fetching activitiesPromises...');
    await Promise.all(activitiesPromises).catch(reason => console.log(reason));
    this.logger.log('fetched activitiesPromises');

    const uniqueInstanceId = Array.from(
      new Set(activities.map(activity => activity.activityDetails.instanceId)),
    );
    const uniqueActivities = [];
    for (let i = 0; i < uniqueInstanceId.length; i++) {
      for (let j = 0; j < activities.length; j++) {
        if (activities[i].activityDetails.instanceId === uniqueInstanceId[i]) {
          uniqueActivities.push(activities[i]);
          break;
        }
      }
    }

    const pgcrPromises = [];
    const pgcrEntities: PgcrEntity[] = [];
    const pgcrEntryEntities: PgcrEntryEntity[] = [];
    const destinyProfileEntities: DestinyProfileEntity[] = [];

    const createPgcrPromise = async (
      activity: DestinyHistoricalStatsPeriodGroup,
    ) => {
      await getPostGameCarnageReport(config => this.bungieRequest(config), {
        activityId: activity.activityDetails.instanceId,
      })
        .then(pgcr => {
          const pgcrEntity = new PgcrEntity();
          pgcrEntities.push(pgcrEntity);

          pgcrEntity.instanceId = pgcr.Response.activityDetails.instanceId;
          pgcrEntity.membershipType =
            pgcr.Response.activityDetails.membershipType;
          pgcrEntity.period = pgcr.Response.period;

          for (let i = 0; i < pgcr.Response.entries.length; i++) {
            const entry = pgcr.Response.entries[i];
            if (
              entry.player.destinyUserInfo.membershipId &&
              entry.player.destinyUserInfo.displayName
            ) {
              const entryEntity = new PgcrEntryEntity();
              entryEntity.instance = pgcrEntity;
              pgcrEntryEntities.push(entryEntity);

              entryEntity.profile = new DestinyProfileEntity();
              entryEntity.profile.displayName =
                entry.player.destinyUserInfo.displayName;
              entryEntity.profile.membershipId =
                entry.player.destinyUserInfo.membershipId;
              entryEntity.profile.membershipType =
                entry.player.destinyUserInfo.membershipType;

              destinyProfileEntities.push(entryEntity.profile);

              if (entry.values.team) {
                entryEntity.team = entry.values.team.basic.value;
              }

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
            }
          }
        })
        .catch(e => e);
    };

    for (let i = 0; i < activities.length; i++) {
      const activity = uniqueActivities[i];
      const pgcrPromise = createPgcrPromise(activity);
      pgcrPromises.push(pgcrPromise);
    }

    this.logger.log(`fetching ${pgcrPromises.length} PGCRs...`);
    await Promise.all(pgcrPromises).catch(reason => console.log(reason));
    this.logger.log('fetched pgcrPromises');

    const uniqueMembershipIdSet = Array.from(
      new Set(destinyProfileEntities.map(entity => entity.membershipId)),
    );
    const uniqueProfiles = [];
    for (let i = 0; i < uniqueMembershipIdSet.length; i++) {
      const membershipId = uniqueMembershipIdSet[i];
      for (let j = 0; j < destinyProfileEntities.length; j++) {
        const entity = destinyProfileEntities[j];
        if (entity.membershipId === membershipId) {
          uniqueProfiles.push(entity);
          break;
        }
      }
    }

    // const saveProfileEntities = [];
    // for (let i = 0; i < uniqueProfiles.length; i++) {
    //   const destinyProfileEntity = uniqueProfiles[i];
    //   const saveEntity = getRepository(DestinyProfileEntity)
    //     .save(destinyProfileEntity, {
    //       listeners: false,
    //       reload: false,
    //     })
    //     .catch(reason => console.log(reason));

    //   saveProfileEntities.push(saveEntity);
    // }

    this.logger.log(`saving ${uniqueProfiles.length} uniqueProfiles...`);
    // await Promise.all(saveProfileEntities);
    if (uniqueProfiles.length) {
      await upsert(
        DestinyProfileEntity,
        uniqueProfiles,
        'membershipId',
      ).catch(reason => this.logger.log(reason));
    }
    this.logger.log('saved saveProfileEntities');

    // const savePgcrEntities = [];
    // for (let i = 0; i < pgcrEntities.length; i++) {
    //   const entity = pgcrEntities[i];
    //   const saveEntity = getRepository(PgcrEntity)
    //     .save(entity, {
    //       listeners: false,
    //       reload: false,
    //     })
    //     .catch(reason => console.log(reason));
    //   savePgcrEntities.push(saveEntity);
    // }

    this.logger.log(`saving ${pgcrEntities.length} pgcrEntities...`);
    // await Promise.all(savePgcrEntities);
    if (pgcrEntities.length) {
      await upsert(PgcrEntity, pgcrEntities, 'instanceId').catch(reason =>
        this.logger.log(reason),
      );
    }
    this.logger.log('saved savePgcrEntities');

    // const savePgcrEntryEntities = [];
    // for (let i = 0; i < pgcrEntryEntities.length; i++) {
    //   const entity = pgcrEntryEntities[i];
    //   const saveEntity = getRepository(PgcrEntryEntity)
    //     .save(entity, {
    //       listeners: false,
    //       reload: false,
    //     })
    //     .catch(reason => console.log(reason));
    //   savePgcrEntryEntities.push(saveEntity);
    // }

    this.logger.log(`saving ${pgcrEntryEntities.length} pgcrEntryEntities...`);
    // await Promise.all(savePgcrEntryEntities);
    if (pgcrEntryEntities.length) {
      await upsert(
        PgcrEntryEntity,
        pgcrEntryEntities,
        'profile", "instance',
      ).catch(reason => this.logger.log(reason));
    }
    this.logger.log('saved savePgcrEntryEntities');
  }

  async addTwitchPartnerships() {
    const profiles = await getConnection()
      .createQueryBuilder(DestinyProfileEntity, 'profile')
      .where('profile.bnetProfile IS NULL')
      .getMany();

    for (let i = 0; i < profiles.length; i++) {
      const existingProfile = profiles[i];
      getLinkedProfiles(config => this.bungieRequest(config), {
        membershipId: existingProfile.membershipId,
        membershipType: existingProfile.membershipType,
        getAllMemberships: true,
      }).then(linkedProfiles => {
        console.log('got linked profiles');
        if (linkedProfiles?.Response?.bnetMembership?.membershipId) {
          const bungieProfileEntity = new BungieProfileEntity();
          bungieProfileEntity.membershipId =
            linkedProfiles.Response.bnetMembership.membershipId;
          bungieProfileEntity.membershipType =
            linkedProfiles.Response.bnetMembership.membershipType;

          getPartnerships(config => this.bungieRequest(config), {
            membershipId: linkedProfiles.Response.bnetMembership.membershipId,
          }).then(partnerships => {
            console.log('got partnerships');

            if (
              partnerships?.Response[0]?.partnerType === PartnershipType.Twitch
            ) {
              bungieProfileEntity.twitchPartnershipIdentifier =
                partnerships.Response[0].identifier;
            }
            for (
              let j = 0;
              j < linkedProfiles?.Response?.profiles?.length;
              j++
            ) {
              const profile = linkedProfiles.Response.profiles[j];

              const destinyProfileEntity = new DestinyProfileEntity();
              destinyProfileEntity.bnetProfile = bungieProfileEntity;
              destinyProfileEntity.displayName = profile.displayName;
              destinyProfileEntity.membershipId = profile.membershipId;
              destinyProfileEntity.membershipType = profile.membershipType;

              getConnection().manager.save(destinyProfileEntity);
              console.log('saved');
            }
          });
        }
      });
    }
  }

  async findAllActivitiesForMembershipId(membershipId: string) {
    const profile = await getRepository(DestinyProfileEntity).findOne(
      membershipId,
    );

    console.log(profile);

    const entries = await getRepository(PgcrEntryEntity)
      .createQueryBuilder()
      .relation(DestinyProfileEntity, 'entries')
      .of(profile)
      .loadMany();

    console.log(entries);
  }

  async findAllPgcrsForProfile(membershipId: string) {
    const profile = await getConnection()
      .createQueryBuilder(DestinyProfileEntity, 'profile')
      .leftJoinAndSelect('profile.entries', 'entry')
      .leftJoinAndSelect('entry.instance', 'pgcr')
      .leftJoinAndSelect('pgcr.entries', 'pgcrentry')
      .leftJoinAndSelect('pgcrentry.profile', 'pgcrprofile')
      .where('profile.membershipId = :membershipId', { membershipId })
      .getOne();

    return profile;
  }

  async findAllEncounteredPlayers(membershipId: string) {
    const profile = await getConnection()
      .createQueryBuilder(DestinyProfileEntity, 'profile')
      .leftJoinAndSelect('profile.entries', 'entry')
      .leftJoinAndSelect('entry.instance', 'pgcr')
      .leftJoinAndSelect('pgcr.entries', 'pgcrentry')
      .leftJoinAndSelect('pgcrentry.profile', 'pgcrprofile')
      .leftJoinAndSelect('pgcrprofile.bnetProfile', 'bnetProfile')
      .where('profile.membershipId = :membershipId', { membershipId })
      .getOne();

    let players: DestinyProfileEntity[] = [];

    for (let i = 0; i < profile.entries.length; i++) {
      const pgcr = profile.entries[i].instance;

      for (let j = 0; j < pgcr.entries.length; j++) {
        const player = pgcr.entries[j].profile;
        players.push(player);
      }
    }

    players = Array.from(
      new Set(players.map(player => player.membershipId)),
    ).map(id => {
      for (let i = 0; i < players.length; i++) {
        if (players[i].membershipId === id) {
          return players[i];
        }
      }
    });
    console.log(players);
  }

  async findAllEncounteredClips(membershipId: string) {
    const profile = await getConnection()
      .createQueryBuilder(DestinyProfileEntity, 'profile')
      .leftJoinAndSelect('profile.entries', 'entry')
      .leftJoinAndSelect('entry.instance', 'pgcr')
      .leftJoinAndSelect('pgcr.entries', 'pgcrentry')
      .leftJoinAndSelect('pgcrentry.profile', 'pgcrprofile')
      .leftJoinAndSelect('pgcrprofile.xboxNameMatch', 'pgcrxbox')
      .leftJoinAndSelect('pgcrxbox.clips', 'clip')
      .where(
        'profile.membershipId = :membershipId AND entry.timePlayedRange && clip.dateRecordedRange',
        { membershipId },
      )
      .getOne();

    profile?.entries?.forEach(entry => {
      entry.instance?.entries?.forEach(player => {
        player.profile?.xboxNameMatch?.clips?.forEach(clip => {
          console.log(player, clip);
        });
      });
    });
  }

  async bungieRequest(config: HttpClientConfig) {
    const requestConfig = {
      ...config,
      headers: {
        'X-API-Key': process.env.BUNGIE_API_KEY,
      },
      timeout: 3000,
    };
    return this.httpService
      .request(requestConfig)
      .pipe(map(res => res.data))
      .toPromise();
  }
}
