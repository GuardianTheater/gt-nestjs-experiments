import { Entity, PrimaryColumn, Column, ManyToOne } from 'typeorm';
import { MixerRecordingEntity } from './mixer-recording.entity';

@Entity()
export class MixerVodEntity {
  @PrimaryColumn()
  id: number;

  @Column()
  baseUrl: string;

  @Column()
  format: 'hls' | 'raw' | 'dash' | 'thumbnail' | 'chat';

  @ManyToOne(
    () => MixerRecordingEntity,
    recording => recording.vods,
  )
  recording: MixerRecordingEntity;

  @Column({
    nullable: true,
  })
  width?: number;

  @Column({
    nullable: true,
  })
  height?: number;
}
