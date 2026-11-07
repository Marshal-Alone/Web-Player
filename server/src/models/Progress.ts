import { Schema, model, Document, Types } from 'mongoose';

export interface IProgress extends Document {
  profileId: Types.ObjectId;
  videoId: Types.ObjectId;
  sectionId?: Types.ObjectId;
  currentTime: number;
  duration: number;
  completed: boolean;
  lastWatched: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProgressSchema = new Schema<IProgress>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
    },
    videoId: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section'
    },
    currentTime: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 0
    },
    completed: {
      type: Boolean,
      default: false,
      index: true
    },
    lastWatched: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index on (profileId, videoId) to guarantee 1 progress record per video per profile
ProgressSchema.index({ profileId: 1, videoId: 1 }, { unique: true });
ProgressSchema.index({ profileId: 1, lastWatched: -1 });

export const Progress = model<IProgress>('Progress', ProgressSchema);
