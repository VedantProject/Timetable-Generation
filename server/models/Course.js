import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema({
  sectionId: {
    type: String,
    required: true,
  },
  assignedFacultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

const courseSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    courseName: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    isLab: {
      type: Boolean,
      default: false,
    },
    labDurationHours: {
      type: Number,
      default: 0,
    },
    weeklyTheoryHours: {
      type: Number,
      default: 0,
    },
    weeklyLabHours: {
      type: Number,
      default: 0,
    },
    sections: [sectionSchema],
  },
  {
    timestamps: true,
  }
);

const Course = mongoose.model("Course", courseSchema);

export default Course;
