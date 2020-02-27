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
import { PgcrEntryEntity } from './pgcr-entry.entity';

@Entity()
export class DestinyProfileEntity {
  @PrimaryColumn()
  membershipId: string;

  @Column()
  membershipType: number;

  @Column()
  displayName: string;

  @OneToOne(() => XboxAccountEntity, {
    cascade: true,
  })
  @JoinColumn()
  xboxAccount?: XboxAccountEntity;

  @ManyToOne(
    () => BungieProfileEntity,
    profile => profile.profiles,
    {
      cascade: true,
      nullable: true,
    },
  )
  bnetProfile?: BungieProfileEntity;

  @OneToMany(
    () => DestinyCharacterEntity,
    character => character.profile,
    {
      cascade: true,
    },
  )
  characters?: DestinyCharacterEntity[];

  @OneToMany(
    () => PgcrEntryEntity,
    entry => entry.profile,
  )
  entries?: PgcrEntryEntity[];
}
