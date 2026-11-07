import { Schema, model, Document } from 'mongoose';

export type ProfileKey = 'dsa' | 'development';

export interface IProfileStats {
  totalSections: number;
  totalVideos: number;
  totalDuration: number;
}

export interface IProfile extends Document {
  key: ProfileKey;
  name: string;
  rootPath: string;
  gdriveUrl?: string;
  order: number;
  currentVideoId?: Schema.Types.ObjectId;
  lastScannedAt?: Date;
  stats: IProfileStats;
  createdAt: Date;
  updatedAt: Date;
}

const ProfileSchema = new Schema<IProfile>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ['dsa', 'development'],
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    rootPath: {
      type: String,
      default: '',
      trim: true
    },
    gdriveUrl: {
      type: String,
      default: '',
      trim: true
    },
    order: {
      type: Number,
      default: 0
    },
    currentVideoId: {
      type: Schema.Types.ObjectId,
      ref: 'Video'
    },
    lastScannedAt: {
      type: Date
    },
    stats: {
      totalSections: { type: Number, default: 0 },
      totalVideos: { type: Number, default: 0 },
      totalDuration: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true
  }
);

export const Profile = model<IProfile>('Profile', ProfileSchema);
