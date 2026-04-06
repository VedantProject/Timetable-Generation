import mongoose from "mongoose";

const institutionalConstraintSchema = new mongoose.Schema(
  {
    semester: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    workingDays: [
      {
        type: String,
      },
    ],
    periodsPerDay: {
      type: Number,
      required: true,
      default: 8,
    },
    periodDuration: {
      type: Number,
      required: true,
      default: 60, // minutes
    },
    breakPeriods: [
      {
        type: Number,
      }, // e.g. [4, 5] for lunch breaks
    ],
    rooms: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Ensure only one constraint per semester + department exists
institutionalConstraintSchema.index({ semester: 1, department: 1 }, { unique: true });

const InstitutionalConstraint = mongoose.model(
  "InstitutionalConstraint",
  institutionalConstraintSchema
);

export default InstitutionalConstraint;
