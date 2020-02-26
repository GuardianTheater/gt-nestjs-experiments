import { Entity, PrimaryColumn, ManyToOne, OneToMany } from 'typeorm';
import { DestinyProfileEntity } from './destiny-profile.entity';

@Entity()
export class DestinyCharacterEntity {
  @PrimaryColumn()
  characterId: string;

  @ManyToOne(
    type => DestinyProfileEntity,
    profile => profile.characters,
  )
  profile: DestinyProfileEntity;
}
