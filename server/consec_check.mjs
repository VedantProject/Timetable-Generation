// consec_check.mjs — node consec_check.mjs
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const sectionSchema = new mongoose.Schema({ sectionId: String, assignedFacultyId: mongoose.Schema.Types.ObjectId });
const courseSchema  = new mongoose.Schema({ courseCode: String, department: String, year: Number, isLab: Boolean, labDurationHours: Number, weeklyTheoryHours: Number, sections: [sectionSchema] }, { timestamps: true });
const roomSchema    = new mongoose.Schema({ roomId: String, isLab: Boolean });
const icSchema      = new mongoose.Schema({ semester: String, department: String, workingDays: [String], periodsPerDay: Number, breakPeriods: [Number], rooms: [mongoose.Schema.Types.ObjectId] });

const Course = mongoose.model("Course", courseSchema);
const Room   = mongoose.model("Room",   roomSchema);
const IC     = mongoose.model("InstitutionalConstraint", icSchema);

await mongoose.connect(MONGODB_URI);

const constraints = await IC.findOne({ department: "CSE", semester: "Fall 2024" });
const courses     = await Course.find({ department: "CSE" }).lean();
const rooms       = await Room.find({ _id: { $in: constraints.rooms } }).lean();

const cleanCourses = courses.map(c => ({ ...c, _id: c._id.toString(), sections: c.sections.map(s => ({ ...s, _id: s._id?.toString(), assignedFacultyId: s.assignedFacultyId?.toString() || null })) }));
const cleanRooms   = rooms.map(r => ({ ...r, _id: r._id.toString() }));
const cleanCons    = { ...constraints.toObject(), _id: constraints._id.toString(), rooms: constraints.rooms.map(r => r.toString()) };

const worker = new Worker(path.resolve(__dirname, "workers/timetableWorker.js"), {
  workerData: { courses: cleanCourses, rooms: cleanRooms, constraints: cleanCons, facultyPreferences: [] }
});

worker.on("message", result => {
  if (!result.success) { console.error("FAILED:", result.reason); process.exit(1); }
  const entries = result.timetable;
  console.log(`\n✅ Total entries: ${entries.length}`);

  // Group by year+section, then check each day for consecutive same-course
  const batches = [...new Set(entries.map(e => `${e.year}_${e.sectionId}`))].sort();
  let violations = 0;

  batches.forEach(batchId => {
    const [yr, sec] = batchId.split("_");
    const batchEntries = entries.filter(e => e.year === Number(yr) && e.sectionId === sec);
    const days = [...new Set(batchEntries.map(e => e.day))];

    days.forEach(day => {
      const dayEntries = batchEntries
        .filter(e => e.day === day && !e.isLab)
        .sort((a, b) => a.period - b.period);

      for (let i = 0; i < dayEntries.length - 1; i++) {
        const curr = dayEntries[i];
        const next = dayEntries[i + 1];
        if (curr.courseId === next.courseId && next.period === curr.period + 1) {
          console.error(`❌ CONSECUTIVE! Year${yr} Sec${sec} ${day}: P${curr.period} & P${next.period} both = ${curr.courseId}`);
          violations++;
        }
      }
    });

    const count = batchEntries.length;
    console.log(`  Year ${yr} Section ${sec}: ${count} slots`);
  });

  if (violations === 0) {
    console.log("\n✅ No consecutive same-course violations found!");
  } else {
    console.log(`\n❌ ${violations} consecutive same-course violation(s) found!`);
  }
  process.exit(violations > 0 ? 1 : 0);
});

worker.on("error", err => { console.error("Worker error:", err); process.exit(1); });
