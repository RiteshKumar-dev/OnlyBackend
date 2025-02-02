import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title must be less than 100 characters'],
    },
    subTitle: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title must be less than 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    level: {
      type: String,
      required: [true, 'Level is required'],
      enum: {
        values: ['Beginner', 'Intermediate', 'Advanced'],
        message: 'Invalid level',
      },
      default: 'Beginner',
      trim: true,
      set: (value) => String(value), // Cast to string
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    thumbnail: {
      type: String,
      required: [true, 'Thumbnail is required'],
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be greater than 0'],
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Course instructor is required'],
    },
    lectures: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lecture',
      },
    ],
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner field is required.'],
    },
    totalDuration: {
      type: Number,
      default: 0,
    },
    totalLectures: {
      type: Number,
      default: 0,
    },
    enrolledStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);
courseSchema.virtual('averageRating').get(function () {
  if (!this.reviews || this.reviews.length === 0) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < this.reviews.length; i++) {
    total += this.reviews[i].rating;
  }

  return total / this.reviews.length;
});

courseSchema.pre('save', function (next) {
  if (this.lectures && Array.isArray(this.lectures)) {
    let totalDuration = 0;
    for (const lecture of this.lectures) {
      totalDuration += lecture.duration || 0; // Ensure duration exists
    }
    this.totalLectures = this.lectures.length;
    this.totalDuration = totalDuration;
  } else {
    this.totalLectures = 0;
    this.totalDuration = 0;
  }
  next();
});

export const Course = mongoose.model('Course', courseSchema);
