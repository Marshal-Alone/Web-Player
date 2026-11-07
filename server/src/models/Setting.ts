import { Schema, model, Document } from 'mongoose';

export interface ISetting extends Document {
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const SettingSchema = new Schema<ISetting>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    value: {
      type: Schema.Types.Mixed,
      required: true
    }
  },
  {
    timestamps: true
  }
);

export const Setting = model<ISetting>('Setting', SettingSchema);
