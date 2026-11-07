import { Schema, model, Document, Types } from 'mongoose';

export interface INote extends Document {
  videoId: Types.ObjectId;
  profileId: Types.ObjectId;
  sectionId?: Types.ObjectId;
  timestamp: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
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
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section'
    },
    timestamp: {
      type: Number,
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

NoteSchema.index({ videoId: 1, timestamp: 1 });
NoteSchema.index({ profileId: 1, createdAt: -1 });

export const Note = model<INote>('Note', NoteSchema);
