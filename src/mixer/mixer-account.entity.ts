import { Entity, PrimaryColumn, Column, OneToOne } from 'typeorm';
import { MixerChannelEntity } from './mixer-channel.entity';

@Entity()
export class MixerAccountEntity {
  @PrimaryColumn()
  id: number;

  @Column()
  username: string;

  @OneToOne(
    () => MixerChannelEntity,
    channel => channel.user,
  )
  channel: MixerChannelEntity;
}
