import mongoose from "mongoose";

const slotSchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
  },
  period: {
    type: Number,
    required: true, // 1 to 8 usually
  },
}, { _id: false });

const facultyPreferenceSchema = new mongoose.Schema(
  {
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    semester: {
      type: String,
      required: true,
      trim: true,
    },
    maxWeeklyHours: {
      type: Number,
      default: 40,
    },
    unavailableSlots: [slotSchema], // Hard constraint
    preferredSlots: [slotSchema],   // Soft constraint
    isLocked: {
      type: Boolean,
      default: false, // Admin locks after deadline
    },
  },
  {
    timestamps: true,
  }
);

facultyPreferenceSchema.index({ facultyId: 1, semester: 1 }, { unique: true });

const FacultyPreference = mongoose.model("FacultyPreference", facultyPreferenceSchema);

export default FacultyPreference;
