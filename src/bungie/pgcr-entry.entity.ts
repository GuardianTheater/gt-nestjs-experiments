import { Entity, ManyToOne, Column, PrimaryColumn } from 'typeorm';
import { PgcrEntity } from './pgcr.entity';
import { DestinyProfileEntity } from './destiny-profile.entity';

@Entity()
export class PgcrEntryEntity {
  @ManyToOne(
    type => DestinyProfileEntity,
    profile => profile.entries,
    {
      cascade: true,
      primary: true,
    },
  )
  profile: DestinyProfileEntity;

  @ManyToOne(
    type => PgcrEntity,
    pgcr => pgcr.entries,
    {
      primary: true,
      eager: true,
    },
  )
  instance: PgcrEntity;

  @Column('tstzrange')
  timePlayedRange: string;

  @Column({
    nullable: true,
  })
  fireteamId?: string;
}
