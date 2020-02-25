import { Entity, PrimaryColumn, Column, ManyToOne } from 'typeorm';
import { XboxAccountEntity } from './xbox-account.entity';

@Entity()
export class XboxClipEntity {
  @PrimaryColumn()
  gameClipId: string;

  @Column()
  scid: string;

  @ManyToOne(
    type => XboxAccountEntity,
    gamertag => gamertag.clips,
    {
      eager: true,
      cascade: true,
    },
  )
  gamertag: XboxAccountEntity;

  @Column('tstzrange')
  dateRecordedRange: string;

  @Column()
  thumbnailUri: string;
}
