import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity()
export class XboxClip {
  @PrimaryColumn()
  gameClipId: string;

  @Column()
  xuid: string;

  @Column()
  @Index()
  gamertag: string;

  @Column()
  scid: string;

  @Column('tstzrange')
  dateRecordedRange: string;

  @Column()
  thumbnailUri: string;
}
