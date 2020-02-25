import { Injectable, HttpService } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AxiosResponse } from 'axios';
import { XboxGameClipsResponse } from './xbox.types';
import { InjectRepository } from '@nestjs/typeorm';
import { XboxClip } from './xbox-clip.entity';
import { Repository, Connection } from 'typeorm';

@Injectable()
export class XboxService {
  titleId = 144389848;
  pcTitleId = 1762047744;

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(XboxClip)
    private xboxClipRespository: Repository<XboxClip>,
    private readonly connection: Connection,
  ) {}

  updateClipsForGamertag(gamertag: string) {
    this.fetchClipsFromXRU(gamertag)
      .pipe(
        map((res: AxiosResponse<XboxGameClipsResponse>) => {
          try {
            const xboxClips: XboxClip[] = [];
            res.data.gameClips.forEach(clip => {
              const endStamp = new Date(clip.dateRecorded);
              endStamp.setSeconds(
                endStamp.getSeconds() + clip.durationInSeconds,
              );
              const xboxClip = new XboxClip();
              xboxClip.gameClipId = clip.gameClipId;
              xboxClip.xuid = clip.xuid;
              xboxClip.gamertag = gamertag;
              xboxClip.scid = clip.scid;
              xboxClip.thumbnailUri = clip.thumbnails.pop().uri;
              xboxClip.dateRecordedRange = `[${
                clip.dateRecorded
              }, ${endStamp.toISOString()}]`;
              xboxClips.push(xboxClip);
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

  findAll(): Promise<XboxClip[]> {
    return this.xboxClipRespository.find();
  }

  async createMany(xboxClips: XboxClip[]) {
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
