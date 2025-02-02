import mongoose from 'mongoose';

const lectureProgressSchema = new mongoose.Schema({
  lecture: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecture',
    required: [true, 'Lecture reference is required'],
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  watchTime: {
    type: Number,
    default: 0,
    min: 0, // Ensuring watchTime is never negative
  },
  lastWatched: {
    type: Date,
    default: Date.now,
  },
});

const courseProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      set: (val) => Math.min(100, Math.max(0, val)), // Ensure value is within 0-100
    },
    lectureProgress: [lectureProgressSchema],
    lastAccessed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Middleware: Calculate completion percentage before saving
courseProgressSchema.pre('save', function (next) {
  if (this.lectureProgress.length > 0) {
    const completedLectures = this.lectureProgress.filter((lp) => lp.isCompleted).length;
    const newCompletionPercentage = Math.round((completedLectures / this.lectureProgress.length) * 100);

    // Update only if completion percentage changes
    if (this.completionPercentage !== newCompletionPercentage) {
      this.completionPercentage = newCompletionPercentage;
      this.isCompleted = newCompletionPercentage === 100;
    }
  }
  next();
});

// Method: Update last accessed timestamp
courseProgressSchema.methods.updateLastAccessed = function () {
  this.lastAccessed = Date.now();
  return this.save({ validateBeforeSave: false });
};

// Method: Mark a lecture as completed
courseProgressSchema.methods.markLectureCompleted = function (lectureId) {
  const lecture = this.lectureProgress.find((lp) => lp.lecture.toString() === lectureId.toString());
  if (lecture && !lecture.isCompleted) {
    lecture.isCompleted = true;
    return this.save();
  }
  return Promise.resolve(this);
};

export const CourseProgress = mongoose.model('CourseProgress', courseProgressSchema);
