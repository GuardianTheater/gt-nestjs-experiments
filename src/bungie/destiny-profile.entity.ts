import { Entity, OneToOne, JoinColumn, Column } from 'typeorm';
import { XboxAccountEntity } from 'src/xbox/xbox-account.entity';
import { TwitchAccountEntity } from 'src/twitch/twitch-account.entity';
import { MixerAccountEntity } from 'src/mixer/mixer-account.entity';
import { DestinyProfileBaseEntity } from './destiny-profile-base.entity';

@Entity()
export class DestinyProfileEntity extends DestinyProfileBaseEntity {
  @OneToOne(() => XboxAccountEntity, {
    nullable: true,
  })
  @JoinColumn({
    name: 'xboxNameMatch',
  })
  xboxNameMatch?: XboxAccountEntity;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  xboxNameMatchChecked?: string;

  @OneToOne(() => TwitchAccountEntity, {
    nullable: true,
  })
  @JoinColumn({ name: 'twitchNameMatch' })
  twitchNameMatch?: TwitchAccountEntity;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  twitchNameMatchChecked?: string;

  @OneToOne(() => MixerAccountEntity, {
    nullable: true,
  })
  @JoinColumn({ name: 'mixerNameMatch' })
  mixerNameMatch?: MixerAccountEntity;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  mixerNameMatchChecked?: string;
}
