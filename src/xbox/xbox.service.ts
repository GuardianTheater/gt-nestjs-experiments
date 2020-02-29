import { Injectable, HttpService } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { XboxGameClipsResponse } from './xbox.types';
import { InjectRepository } from '@nestjs/typeorm';
import { XboxClipEntity } from './xbox-clip.entity';
import { Repository, Connection, getConnection } from 'typeorm';
import { XboxAccountEntity } from './xbox-account.entity';

@Injectable()
export class XboxService {
  titleId = 144389848;
  pcTitleId = 1762047744;
  daysOfHistory = parseInt(process.env.DAYS_OF_HISTORY, 10);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(XboxClipEntity)
    private xboxClipRespository: Repository<XboxClipEntity>,
    @InjectRepository(XboxAccountEntity)
    private xboxAccountRespository: Repository<XboxAccountEntity>,
    private readonly connection: Connection,
  ) {}

  async updateClipsForGamertag(gamertag: string) {
    const xboxAccount = await this.xboxAccountRespository.findOne(gamertag);
    xboxAccount.lastClipCheck = new Date().toISOString();

    const clips = await this.fetchClipsFromXRU(gamertag);
    console.log('fetched new clips for', gamertag);

    const dateCutOff = new Date(
      new Date().setDate(new Date().getDate() - this.daysOfHistory),
    );

    const xboxClips: XboxClipEntity[] = [];
    clips.data?.gameClips?.some(clip => {
      const endStamp = new Date(clip.dateRecorded);
      if (endStamp < dateCutOff) {
        return true;
      }
      endStamp.setSeconds(endStamp.getSeconds() + clip.durationInSeconds);
      const xboxClipEntity = new XboxClipEntity();
      xboxClipEntity.gameClipId = clip.gameClipId;
      xboxClipEntity.xboxAccount = xboxAccount;
      xboxClipEntity.xuid = clip.xuid;
      xboxClipEntity.scid = clip.scid;
      xboxClipEntity.thumbnailUri = clip.thumbnails.pop().uri;
      xboxClipEntity.dateRecordedRange = `[${
        clip.dateRecorded
      }, ${endStamp.toISOString()}]`;
      xboxClips.push(xboxClipEntity);
    });

    await this.xboxClipRespository
      .find({ where: { xboxAccount: gamertag } })
      .then(oldClips => {
        for (let i = 0; i < oldClips.length; i++) {
          const oldClip = oldClips[i];
          let match = false;
          xboxClips.some(newClip => {
            if (newClip.gameClipId === oldClip.gameClipId) {
              match = true;
              return true;
            }
          });
          if (!match) {
            this.xboxClipRespository.delete(oldClip.gameClipId);
          }
        }
        console.log('deleted old clips for', gamertag);
      });

    await getConnection().manager.save(xboxClips);
    console.log('created new clips for', gamertag);
  }

  async fetchClipsFromXRU(
    gamertag?: string,
  ): Promise<AxiosResponse<XboxGameClipsResponse>> {
    const uri = `https://api.xboxrecord.us/gameclips/gamertag/${gamertag}/titleid/${this.titleId}`;
    return this.httpService.get(uri).toPromise();
  }

  clipCount(): Promise<number> {
    return this.xboxClipRespository.count();
  }

  findAll(): Promise<XboxClipEntity[]> {
    return this.xboxClipRespository.find();
  }

  findAllAccounts(): Promise<XboxAccountEntity[]> {
    return this.xboxAccountRespository.find();
  }

  async updateClipsForAllAccounts() {
    const accounts = await this.xboxAccountRespository.find();

    accounts.forEach(account => {
      this.updateClipsForGamertag(account.gamertag);
    });
  }
}
