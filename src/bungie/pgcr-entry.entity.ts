import { Entity, ManyToOne, Column } from 'typeorm';
import { PgcrEntity } from './pgcr.entity';
import { DestinyProfileEntity } from './destiny-profile.entity';

@Entity()
export class PgcrEntryEntity {
  @ManyToOne(
    () => DestinyProfileEntity,
    profile => profile.entries,
    {
      cascade: true,
      primary: true,
    },
  )
  profile: DestinyProfileEntity;

  @ManyToOne(
    () => PgcrEntity,
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
  team?: number;
}
