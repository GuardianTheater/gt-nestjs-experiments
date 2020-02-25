import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity()
export class DestinyProfile {
  @PrimaryColumn()
  membershipId: string;

  @Column()
  membershipType: number;

  @Column()
  displayName: string;

  @Column()
  @Index()
  bnetMembershipId: string;

  @Column()
  twitchPartnershipIdentifier: string;
}
