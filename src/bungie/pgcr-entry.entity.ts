import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from 'typeorm';
import { PgcrEntity } from './pgcr.entity';
import { DestinyProfileEntity } from './destiny-profile.entity';

@Entity()
export class PgcrEntryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('tstzrange')
  timePlayedRange: string;

  @ManyToOne(
    type => PgcrEntity,
    pgcr => pgcr.entries,
  )
  instance: PgcrEntity;

  @ManyToOne(
    type => DestinyProfileEntity,
    profile => profile.entries,
    {
      cascade: true,
    },
  )
  profile: DestinyProfileEntity;

  @Column({
    nullable: true,
  })
  fireteamId?: string;
}
