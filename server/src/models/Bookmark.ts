import { Schema, model, Document, Types } from 'mongoose';

export interface IBookmark extends Document {
  videoId: Types.ObjectId;
  profileId: Types.ObjectId;
  timestamp: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookmarkSchema = new Schema<IBookmark>(
  {
    videoId: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true
    },
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
    },
    timestamp: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

BookmarkSchema.index({ videoId: 1, timestamp: 1 });
BookmarkSchema.index({ profileId: 1, createdAt: -1 });

export const Bookmark = model<IBookmark>('Bookmark', BookmarkSchema);
