import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface UserSettings {
  themePreference: 'light' | 'dark';
}

export interface UserAttrs {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  settings?: UserSettings;
}

export interface UserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDoc = HydratedDocument<UserAttrs, UserMethods>;

type UserModel = Model<UserAttrs, Record<string, never>, UserMethods>;

const userSchema = new Schema<UserAttrs, UserModel, UserMethods>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    settings: {
      themePreference: {
        type: String,
        enum: ['light', 'dark'],
        default: 'dark',
      },
    },
  },
  { timestamps: true },
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as { password?: unknown }).password;
    return ret;
  },
});

export const User = mongoose.model<UserAttrs, UserModel>('User', userSchema);
export default User;
