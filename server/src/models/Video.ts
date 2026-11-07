import { Schema, model, Document, Types } from 'mongoose';

export interface IVideo extends Document {
  sectionId: Types.ObjectId;
  profileId: Types.ObjectId;
  title: string;
  fileName: string;
  badge: string;
  relPath: string;
  fullPath: string;
  order: number;
  size: number;
  mtime: Date;
  duration: number | null;
  missing: boolean;
  hasSubtitles: boolean;
  subtitlePath?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    badge: {
      type: String,
      default: '',
      trim: true
    },
    relPath: {
      type: String,
      required: true,
      trim: true
    },
    fullPath: {
      type: String,
      required: true,
      trim: true
    },
    order: {
      type: Number,
      required: true,
      index: true
    },
    size: {
      type: Number,
      required: true
    },
    mtime: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,
      default: null
    },
    missing: {
      type: Boolean,
      default: false
    },
    hasSubtitles: {
      type: Boolean,
      default: false
    },
    subtitlePath: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

VideoSchema.index({ profileId: 1, relPath: 1 });
VideoSchema.index({ size: 1, mtime: 1 });
VideoSchema.index({ sectionId: 1, order: 1 });

export const Video = model<IVideo>('Video', VideoSchema);
