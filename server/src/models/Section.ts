import { Schema, model, Document, Types } from 'mongoose';

export interface ISection extends Document {
  profileId: Types.ObjectId;
  name: string;
  folderName: string;
  order: number;
  badge: string;
  relPath: string;
  slug?: string;
  videoCount: number;
  totalDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

const SectionSchema = new Schema<ISection>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    folderName: {
      type: String,
      required: true,
      trim: true
    },
    order: {
      type: Number,
      required: true,
      index: true
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
    slug: {
      type: String,
      default: function (this: any) {
        return `${this.profileId || 'sec'}_${this.order ?? 0}_${Math.random().toString(36).substring(2, 9)}`;
      }
    },
    videoCount: {
      type: Number,
      default: 0
    },
    totalDuration: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

SectionSchema.index({ profileId: 1, order: 1 });
SectionSchema.index({ profileId: 1, relPath: 1 });

export const Section = model<ISection>('Section', SectionSchema);
