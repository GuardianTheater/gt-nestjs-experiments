import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { XboxClipEntity } from './xbox-clip.entity';

@Entity()
export class XboxAccountEntity {
  @PrimaryColumn()
  gamertag: string;

  @Column({
    nullable: true,
  })
  xuid?: string;

  @OneToMany(
    type => XboxClipEntity,
    clip => clip.gamertag,
  )
  clips: XboxClipEntity[];
}
