// diag.mjs - Run with: node diag.mjs
// Checks courses with missing faculty and simulates the worker

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const Course = mongoose.model("Course", new mongoose.Schema({
    courseCode: String, courseName: String, department: String, year: Number,
    isLab: Boolean, labDurationHours: Number, weeklyTheoryHours: Number,
    sections: [{ sectionId: String, assignedFacultyId: mongoose.Schema.Types.ObjectId }]
  }));

  const Room = mongoose.model("Room", new mongoose.Schema({
    roomId: String, isLab: Boolean, capacity: Number
  }));

  const InstitutionalConstraint = mongoose.model("InstitutionalConstraint", new mongoose.Schema({
    semester: String, department: String,
    workingDays: [String], periodsPerDay: Number, breakPeriods: [Number],
    rooms: [mongoose.Schema.Types.ObjectId]
  }));

  const department = "CSE";
  const semester = "Fall 2024";

  const constraints = await InstitutionalConstraint.findOne({ department, semester });
  console.log("\n=== CONSTRAINTS ===");
  console.log("Working days:", constraints?.workingDays);
  console.log("Periods/day:", constraints?.periodsPerDay);
  console.log("Break periods:", constraints?.breakPeriods);
  console.log("Rooms linked:", constraints?.rooms?.length);

  const courses = await Course.find({ department }).lean();
  console.log("\n=== COURSES ===", courses.length, "total");
  courses.forEach(c => {
    c.sections.forEach(s => {
      const hasFac = !!s.assignedFacultyId;
      if (!hasFac) console.warn(`  ⚠️  ${c.courseCode} [Year ${c.year}] Section ${s.sectionId} — NO FACULTY ASSIGNED`);
    });
  });

  const rooms = await Room.find({ _id: { $in: constraints.rooms } }).lean();
  console.log("\n=== ROOMS ===", rooms.length, "total");
  console.log("  Lab rooms:", rooms.filter(r => r.isLab).length);
  console.log("  Theory rooms:", rooms.filter(r => !r.isLab).length);

  // Stringify all IDs exactly as controller does
  const cleanCourses = courses.map(c => ({
    ...c,
    _id: c._id.toString(),
    sections: c.sections.map(s => ({
      ...s,
      _id: s._id?.toString(),
      assignedFacultyId: s.assignedFacultyId?.toString() || null
    }))
  }));
  const cleanRooms = rooms.map(r => ({ ...r, _id: r._id.toString() }));
  const cleanConstraints = constraints.toObject();
  cleanConstraints._id = cleanConstraints._id?.toString();
  cleanConstraints.rooms = cleanConstraints.rooms.map(r => r?.toString());

  console.log("\n=== RUNNING WORKER ===");
  const workerPath = path.resolve(__dirname, "workers/timetableWorker.js");
  const worker = new Worker(workerPath, {
    workerData: {
      courses: cleanCourses,
      rooms: cleanRooms,
      constraints: cleanConstraints,
      facultyPreferences: []
    }
  });

  worker.on("message", result => {
    if (result.success) {
      console.log(`\n✅ SUCCESS — ${result.timetable.length} entries generated`);
      // Show distribution
      const byDay = {};
      result.timetable.forEach(e => {
        byDay[e.day] = (byDay[e.day] || 0) + 1;
      });
      console.log("Distribution by day:", byDay);
      const byBatch = {};
      result.timetable.forEach(e => {
        const key = `${e.sectionId}`;
        byBatch[key] = (byBatch[key] || 0) + 1;
      });
      console.log("Entries by section:", byBatch);
    } else {
      console.error("\n❌ FAILED:", result.reason);
    }
    process.exit(0);
  });

  worker.on("error", err => {
    console.error("\n💥 Worker error:", err);
    process.exit(1);
  });
}

run().catch(e => { console.error(e); process.exit(1); });
