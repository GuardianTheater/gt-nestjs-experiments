import { Injectable, HttpService } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AxiosResponse } from 'axios';
import { XboxGameClipsResponse } from './xbox.types';
import { InjectRepository } from '@nestjs/typeorm';
import { XboxClipEntity } from './xbox-clip.entity';
import { Repository, Connection } from 'typeorm';
import { XboxAccountEntity } from './xbox-account.entity';

@Injectable()
export class XboxService {
  titleId = 144389848;
  pcTitleId = 1762047744;

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(XboxClipEntity)
    private xboxClipRespository: Repository<XboxClipEntity>,
    @InjectRepository(XboxAccountEntity)
    private xboxAccountRespository: Repository<XboxAccountEntity>,
    private readonly connection: Connection,
  ) {}

  updateClipsForGamertag(gamertag: string) {
    this.fetchClipsFromXRU(gamertag)
      .pipe(
        map((res: AxiosResponse<XboxGameClipsResponse>) => {
          try {
            const xboxClips: XboxClipEntity[] = [];
            res.data.gameClips.forEach(clip => {
              const endStamp = new Date(clip.dateRecorded);
              endStamp.setSeconds(
                endStamp.getSeconds() + clip.durationInSeconds,
              );
              const xboxClipEntity = new XboxClipEntity();
              const gamertagEntity = new XboxAccountEntity();
              gamertagEntity.gamertag = gamertag;
              gamertagEntity.xuid = clip.xuid;
              xboxClipEntity.gameClipId = clip.gameClipId;
              xboxClipEntity.gamertag = gamertagEntity;
              xboxClipEntity.scid = clip.scid;
              xboxClipEntity.thumbnailUri = clip.thumbnails.pop().uri;
              xboxClipEntity.dateRecordedRange = `[${
                clip.dateRecorded
              }, ${endStamp.toISOString()}]`;
              xboxClips.push(xboxClipEntity);
            });
            this.xboxClipRespository
              .find({ where: { gamertag: gamertag } })
              .then(oldClips => {
                oldClips.forEach(oldClip => {
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
                });
              });
            this.createMany(xboxClips);
          } catch (e) {
            console.log(e);
          }
        }),
      )
      .subscribe();
  }

  fetchClipsFromXRU(
    gamertag?: string,
  ): Observable<AxiosResponse<XboxGameClipsResponse>> {
    const uri = `https://api.xboxrecord.us/gameclips/gamertag/${gamertag}/titleid/${this.titleId}`;
    return this.httpService.get(uri);
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

  async createMany(xboxClips: XboxClipEntity[]) {
    const queryRunner = this.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (let i = 0; i < xboxClips.length; i++) {
        await queryRunner.manager.save(xboxClips[i]);
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
