import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BungieProfileEntity } from './bungie-profile.entity';
import { PgcrEntryEntity } from './pgcr-entry.entity';

@Entity()
export class DestinyProfileBaseEntity {
  @PrimaryColumn()
  membershipId: string;

  @Column()
  membershipType: number;

  @Column()
  displayName: string;

  @ManyToOne(
    () => BungieProfileEntity,
    profile => profile.profiles,
    {
      nullable: true,
    },
  )
  @JoinColumn({
    name: 'bnetProfile',
  })
  bnetProfile?: BungieProfileEntity;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  bnetProfileChecked?: string;

  @OneToMany(
    () => PgcrEntryEntity,
    entry => entry.profile,
  )
  entries?: PgcrEntryEntity[];

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  pageLastVisited?: string;
}
