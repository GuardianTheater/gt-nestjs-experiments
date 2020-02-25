import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { DestinyCharacterEntity } from './destiny-character.entity';
import { BungieProfileEntity } from './bungie-profile.entity';
import { XboxAccountEntity } from 'src/xbox/xbox-account.entity';

@Entity()
export class DestinyProfileEntity {
  @PrimaryColumn()
  membershipId: string;

  @Column()
  membershipType: number;

  @Column()
  displayName: string;

  @OneToOne(type => XboxAccountEntity, {
    cascade: true,
  })
  @JoinColumn()
  xboxAccount: XboxAccountEntity;

  @ManyToOne(
    type => BungieProfileEntity,
    profile => profile.profiles,
    {
      cascade: true,
    },
  )
  bnetProfile: BungieProfileEntity;

  @OneToMany(
    type => DestinyCharacterEntity,
    character => character.profile,
    {
      cascade: true,
    },
  )
  characters: DestinyCharacterEntity[];
}
