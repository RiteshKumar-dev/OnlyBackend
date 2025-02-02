import mongoose from 'mongoose';

const lectureSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title must be less than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description must be less than 500 characters'],
    },
    video: {
      type: String,
      required: [true, 'Video is required'],
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      default: 0,
    },
    isPreview: {
      type: Boolean,
      default: false,
    },
    publicId: {
      type: String,
      required: [true, 'Public ID is required'],
    },
    order: {
      type: Number,
      required: [true, 'Order is required'],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

lectureSchema.pre('save', function (next) {
  if (this.duration > 0) {
    this.duration = Math.round(this.duration * 100) / 100;
  }
  next();
});

export const Lecture = mongoose.model('Lecture', lectureSchema);
