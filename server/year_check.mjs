// year_check.mjs — node year_check.mjs
// Verifies that the worker now includes 'year' in all entries and generates 4 batches

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const sectionSchema = new mongoose.Schema({ sectionId: String, assignedFacultyId: mongoose.Schema.Types.ObjectId });
const courseSchema = new mongoose.Schema({
  courseCode: String, department: String, year: Number,
  isLab: Boolean, labDurationHours: Number, weeklyTheoryHours: Number,
  sections: [sectionSchema]
}, { timestamps: true });
const roomSchema = new mongoose.Schema({ roomId: String, isLab: Boolean });
const constraintSchema = new mongoose.Schema({
  semester: String, department: String,
  workingDays: [String], periodsPerDay: Number, breakPeriods: [Number],
  rooms: [mongoose.Schema.Types.ObjectId]
});

const Course = mongoose.model("Course", courseSchema);
const Room = mongoose.model("Room", roomSchema);
const IC = mongoose.model("InstitutionalConstraint", constraintSchema);

await mongoose.connect(MONGODB_URI);

const constraints = await IC.findOne({ department: "CSE", semester: "Fall 2024" });
const courses = await Course.find({ department: "CSE" }).lean();
const rooms = await Room.find({ _id: { $in: constraints.rooms } }).lean();

// Stringify all IDs (same as controller does)
const cleanCourses = courses.map(c => ({
  ...c, _id: c._id.toString(),
  sections: c.sections.map(s => ({
    ...s, _id: s._id?.toString(), assignedFacultyId: s.assignedFacultyId?.toString() || null
  }))
}));
const cleanRooms = rooms.map(r => ({ ...r, _id: r._id.toString() }));
const cleanConstraints = constraints.toObject();
cleanConstraints._id = cleanConstraints._id?.toString();
cleanConstraints.rooms = cleanConstraints.rooms.map(r => r?.toString());

console.log("\n=== Starting Worker ===");
const worker = new Worker(path.resolve(__dirname, "workers/timetableWorker.js"), {
  workerData: { courses: cleanCourses, rooms: cleanRooms, constraints: cleanConstraints, facultyPreferences: [] }
});

worker.on("message", result => {
  if (!result.success) { console.error("FAILED:", result.reason); process.exit(1); }
  
  const entries = result.timetable;
  console.log(`\n✅ Total entries: ${entries.length}`);

  // Check year field
  const withYear = entries.filter(e => e.year != null).length;
  const withoutYear = entries.filter(e => e.year == null).length;
  console.log(`   With year field: ${withYear}`);
  console.log(`   Without year field: ${withoutYear}`);

  // Group by year+section
  const groups = {};
  entries.forEach(e => {
    const key = `Year ${e.year} Section ${e.sectionId}`;
    groups[key] = (groups[key] || 0) + 1;
  });
  console.log("\n=== Entries per (Year, Section) ===");
  Object.entries(groups).sort().forEach(([k, v]) => console.log(`  ${k}: ${v} slots`));

  // Check for conflicts
  const bySlot = {};
  let facConflicts = 0, roomConflicts = 0;
  entries.forEach(e => {
    const k = `${e.day}_${e.period}`;
    if (!bySlot[k]) bySlot[k] = [];
    bySlot[k].push(e);
  });
  Object.values(bySlot).forEach(slotEntries => {
    const facIds = slotEntries.map(e => e.facultyId).filter(Boolean);
    const roomIds = slotEntries.map(e => e.roomId);
    const dupFac = facIds.length !== new Set(facIds).size;
    const dupRoom = roomIds.length !== new Set(roomIds).size;
    if (dupFac) facConflicts++;
    if (dupRoom) roomConflicts++;
  });
  console.log(`\n=== Conflict Check ===`);
  console.log(`  Faculty conflicts: ${facConflicts}`);
  console.log(`  Room conflicts:    ${roomConflicts}`);
  
  process.exit(0);
});

worker.on("error", err => { console.error("Worker error:", err); process.exit(1); });
