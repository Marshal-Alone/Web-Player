import { Schema, model, Document, Types } from 'mongoose';

export interface IWatchLog extends Document {
  profileId: Types.ObjectId;
  videoId: Types.ObjectId;
  watchedAt: Date;
  date?: string;
  secondsWatched: number;
  createdAt: Date;
  updatedAt: Date;
}

const WatchLogSchema = new Schema<IWatchLog>(
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
    watchedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    date: {
      type: String,
      index: true
    },
    secondsWatched: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

WatchLogSchema.index({ profileId: 1, watchedAt: -1 });
WatchLogSchema.index({ profileId: 1, date: 1 });

export const WatchLog = model<IWatchLog>('WatchLog', WatchLogSchema);
