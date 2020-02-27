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
  daysOfHistory = parseInt(process.env.DAYS_OF_HISTORY, 10);

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
    for (let i = 0; i < linkedProfiles.Response.profiles.length; i++) {
      const profile = linkedProfiles.Response.profiles[i];

      const destinyProfileEntity = new DestinyProfileEntity();
      destinyProfileEntity.bnetProfile = bungieProfileEntity;
      destinyProfileEntity.displayName = profile.displayName;
      destinyProfileEntity.membershipId = profile.membershipId;
      destinyProfileEntity.membershipType = profile.membershipType;

      if (profile.membershipType === BungieMembershipType.TigerXbox) {
        destinyProfileEntity.xboxAccount = new XboxAccountEntity();
        destinyProfileEntity.xboxAccount.gamertag = profile.displayName;
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

      await getConnection().manager.save(destinyProfileEntity);
    }
  }

  async getActivityHistoryForDestinyAccount(membershipId: string) {
    const bnetProfile = await getConnection()
      .createQueryBuilder()
      .relation(DestinyProfileEntity, 'bnetProfile')
      .of(membershipId)
      .loadOne();
    console.log('loaded bnet profile for', membershipId);

    const profiles = await getConnection()
      .createQueryBuilder()
      .relation(BungieProfileEntity, 'profiles')
      .of(bnetProfile)
      .loadMany();
    console.log('loaded destiny profiles for', bnetProfile.membershipId);

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const characters = await getConnection()
        .createQueryBuilder()
        .relation(DestinyProfileEntity, 'characters')
        .of(profile)
        .loadMany();
      console.log('loaded characters for', profile.membershipId);

      for (let j = 0; j < characters.length; j++) {
        const character = characters[j];

        let page = 0;
        let loadMoreActivities = true;
        const dateCutOff = new Date(
          new Date().setDate(new Date().getDate() - this.daysOfHistory),
        );

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
          console.log('fetched activities for', character.characterId);

          for (let k = 0; k < activities.Response.activities.length; k++) {
            const activity = activities.Response.activities[k];

            if (new Date(activity.period) < dateCutOff) {
              loadMoreActivities = false;
              break;
            }

            getPostGameCarnageReport(config => this.bungieRequest(config), {
              activityId: activity.activityDetails.instanceId,
            }).then(pgcr => {
              console.log(
                'fetched pgcr for',
                activity.activityDetails.instanceId,
              );

              const pgcrEntity = new PgcrEntity();

              pgcrEntity.instanceId = pgcr.Response.activityDetails.instanceId;
              pgcrEntity.membershipType =
                pgcr.Response.activityDetails.membershipType;
              pgcrEntity.period = pgcr.Response.period;
              pgcrEntity.entries = [];

              pgcr.Response.entries.forEach(entry => {
                if (entry.player.destinyUserInfo.displayName) {
                  const entryEntity = new PgcrEntryEntity();
                  pgcrEntity.entries.push(entryEntity);

                  entryEntity.profile = new DestinyProfileEntity();

                  entryEntity.profile.displayName =
                    entry.player.destinyUserInfo.displayName;
                  entryEntity.profile.membershipId =
                    entry.player.destinyUserInfo.membershipId;
                  entryEntity.profile.membershipType =
                    entry.player.destinyUserInfo.membershipType;
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
              });

              getConnection().manager.save(pgcrEntity);
            });
          }
          if (activities.Response.activities.length < 250) {
            loadMoreActivities = false;
          }
          page++;
        }
      }
    }
  }

  async addXboxAccounts() {
    const profiles = await getConnection()
      .createQueryBuilder(DestinyProfileEntity, 'profile')
      .leftJoinAndSelect('profile.xboxAccount', 'xboxAccount')
      .where('profile.membershipType = :membershipType', {
        membershipType: BungieMembershipType.TigerXbox,
      })
      .getMany();

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      console.log(profile);
      if (!profile.xboxAccount) {
        profile.xboxAccount = new XboxAccountEntity();
        profile.xboxAccount.gamertag = profile.displayName;

        getConnection().manager.save(profile);
      }
    }
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

              getProfile(config => this.bungieRequest(config), {
                components: [DestinyComponentType.Characters],
                destinyMembershipId: profile.membershipId,
                membershipType: profile.membershipType,
              }).then(profileWithCharacters => {
                console.log('got profile');

                destinyProfileEntity.characters = [];

                for (
                  let k = 0;
                  k <
                  Object.keys(profileWithCharacters.Response.characters.data)
                    .length;
                  k++
                ) {
                  const key = Object.keys(
                    profileWithCharacters.Response.characters.data,
                  )[k];
                  const character =
                    profileWithCharacters.Response.characters.data[key];

                  const destinyCharacterEntity = new DestinyCharacterEntity();
                  destinyCharacterEntity.characterId = character.characterId;

                  destinyProfileEntity.characters.push(destinyCharacterEntity);
                }

                getConnection().manager.save(destinyProfileEntity);
                console.log('saved');
              });
            }
          });
        }
      });
    }
  }

  async findAllActivitiesForAccount(membershipId: string) {
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

    console.log(profiles);

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const entries = await getConnection()
        .createQueryBuilder()
        .relation(DestinyProfileEntity, 'entries')
        .of(profile)
        .loadMany();

      console.log(entries);

      for (let j = 0; j < entries.length; j++) {
        const entry = entries[j];
        const pgcr = await getConnection()
          .createQueryBuilder()
          .relation(PgcrEntryEntity, 'instance')
          .of(entry)
          .loadOne();

        console.log(pgcr);
      }
    }
  }

  async findAllPgcrsForProfile(membershipId: string) {
    const pgcrs = await getConnection()
      .createQueryBuilder(DestinyProfileEntity, 'profile')
      .leftJoinAndSelect('profile.entries', 'entry')
      .leftJoinAndSelect('entry.instance', 'pgcr')
      .leftJoinAndSelect('pgcr.entries', 'pgcrentry')
      .leftJoinAndSelect('pgcrentry.profile', 'pgcrprofile')
      .where('profile.membershipId = :membershipId', { membershipId })
      .getOne();

    return pgcrs;
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
      return players.find(player => player.membershipId === id);
    });
    console.log(players);
  }

  async findAllEncounteredClips(membershipId: string) {
    const pgcrs = await getConnection()
      .createQueryBuilder(DestinyProfileEntity, 'profile')
      .leftJoinAndSelect('profile.entries', 'entry')
      .leftJoinAndSelect('entry.instance', 'pgcr')
      .leftJoinAndSelect('pgcr.entries', 'pgcrentry')
      .leftJoinAndSelect('pgcrentry.profile', 'pgcrprofile')
      .leftJoinAndSelect('pgcrprofile.xboxAccount', 'pgcrxbox')
      .leftJoinAndSelect('pgcrxbox.clips', 'clip')
      .where(
        'profile.membershipId = :membershipId AND entry.timePlayedRange && clip.dateRecordedRange',
        { membershipId },
      )
      .orderBy('')
      .getOne();

    pgcrs?.entries?.forEach(entry => {
      entry.instance?.entries?.forEach(player => {
        player.profile?.xboxAccount?.clips?.forEach(clip => {
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
    };
    return this.httpService
      .request(requestConfig)
      .pipe(map(res => res.data))
      .toPromise();
  }
}
