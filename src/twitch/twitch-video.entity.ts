import { Entity, PrimaryColumn, ManyToOne, Column } from 'typeorm';
import { TwitchAccountEntity } from './twitch-account.entity';

@Entity()
export class TwitchVideoEntity {
  @PrimaryColumn()
  id: string;

  @ManyToOne(
    () => TwitchAccountEntity,
    account => account.videos,
  )
  user: TwitchAccountEntity;

  @Column('tstzrange')
  durationRange: string;

  @Column()
  title: string;

  @Column()
  url: string;

  @Column()
  thumbnail_url: string;
}
