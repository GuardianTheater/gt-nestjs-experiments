import { Entity, PrimaryColumn, Column, OneToOne, OneToMany } from 'typeorm';
import { MixerAccountEntity } from './mixer-account.entity';
import { MixerRecordingEntity } from './mixer-recording.entity';

@Entity()
export class MixerChannelEntity {
  @PrimaryColumn()
  id: number;

  @Column()
  token: string;

  @OneToOne(
    () => MixerAccountEntity,
    account => account.channel,
  )
  user: MixerAccountEntity;

  @OneToMany(
    () => MixerRecordingEntity,
    recording => recording.channel,
  )
  recordings: MixerAccountEntity[];
}
