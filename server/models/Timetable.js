import mongoose from "mongoose";

const timetableEntrySchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
  },
  period: {
    type: Number,
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  sectionId: {
    type: String,
    required: true,
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: true,
  },
  isLab: {
    type: Boolean,
    default: false,
  },
  labBlock: {
    type: Number, // if lab, which consecutive block position (1, 2, 3...)
  },
  isCancelled: {
    type: Boolean,
    default: false,
  },
  isMakeup: {
    type: Boolean,
    default: false,
  },
  originalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
  },
});

const auditLogSchema = new mongoose.Schema({
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  changeType: {
    type: String,
    enum: ["manual_override", "cancellation", "makeup"],
    required: true,
  },
  description: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const timetableSchema = new mongoose.Schema(
  {
    semester: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    publishedAt: {
      type: Date,
    },
    entries: [timetableEntrySchema],
    auditLog: [auditLogSchema],
  },
  {
    timestamps: true,
  }
);

const Timetable = mongoose.model("Timetable", timetableSchema);

export default Timetable;
