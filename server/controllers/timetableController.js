import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";
import Course from "../models/Course.js";
import Room from "../models/Room.js";
import InstitutionalConstraint from "../models/InstitutionalConstraint.js";
import FacultyPreference from "../models/FacultyPreference.js";
import Timetable from "../models/Timetable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory job queue for simplicity. In production, use Redis or a DB table for jobs.
const activeJobs = new Map();

// @desc    Generate a timetable
// @route   POST /api/admin/timetable/generate
// @access  Private/Admin
export const generateTimetable = async (req, res) => {
  try {
    const { semester, department } = req.body;
    
    // 1. Fetch data
    const constraints = await InstitutionalConstraint.findOne({ semester, department });
    if (!constraints) {
      return res.status(400).json({ message: "Constraints not found for this semester" });
    }
    
    const courses = await Course.find({ department }).lean();
    const rooms = await Room.find({ _id: { $in: constraints.rooms } }).lean();
    const facultyPreferences = await FacultyPreference.find({ semester }).lean();
    
    const jobId = `job_${Date.now()}`;
    activeJobs.set(jobId, { status: "running", progress: 0 });
    
    // Stringify all ObjectIds before passing to Worker thread
    // Worker thread serialization converts BSON ObjectIds to plain objects,
    // losing their .toString() method. Pre-stringifying prevents [object Object] keys.
    const cleanCourses = courses.map(c => ({
      ...c,
      _id: c._id.toString(),
      sections: c.sections.map(s => ({
        ...s,
        _id: s._id?.toString(),
        assignedFacultyId: s.assignedFacultyId?.toString()
      }))
    }));
    const cleanRooms = rooms.map(r => ({ ...r, _id: r._id.toString() }));
    const cleanFacultyPrefs = facultyPreferences.map(fp => ({
      ...fp,
      _id: fp._id?.toString(),
      facultyId: fp.facultyId?.toString()
    }));
    const cleanConstraints = constraints.toObject();
    cleanConstraints._id = cleanConstraints._id?.toString();
    if (cleanConstraints.rooms) {
      cleanConstraints.rooms = cleanConstraints.rooms.map(r => r?.toString());
    }

    const workerPath = path.resolve(__dirname, "../workers/timetableWorker.js");
    const worker = new Worker(workerPath, {
      workerData: {
        courses: cleanCourses,
        rooms: cleanRooms,
        constraints: cleanConstraints,
        facultyPreferences: cleanFacultyPrefs
      }
    });
    
    worker.on("message", async (result) => {
      if (result.success) {
        try {
          const rawEntries = result.timetable || [];

          // Guard: worker returned 0 entries — treat as failure
          if (rawEntries.length === 0) {
            activeJobs.set(jobId, {
              status: "failed",
              error: "Worker returned success but generated 0 entries. " +
                     "Ensure all course sections have a faculty member assigned."
            });
            return;
          }

          // Remove null facultyId so Mongoose ObjectId validation doesn't fail
          const cleanEntries = rawEntries.map(e => {
            const entry = { ...e };
            if (!entry.facultyId) delete entry.facultyId;
            return entry;
          });

          console.log(`[Generate] Saving ${cleanEntries.length} entries to DB...`);

          // Delete old, then create new — atomic within the try/catch
          await Timetable.deleteMany({ semester, department });
          
          await Timetable.create({
            semester,
            department,
            status: "draft",
            entries: cleanEntries,
            auditLog: [{ changeType: "manual_override", description: "Algorithm Generation", changedBy: req.user._id }]
          });
          
          console.log(`[Generate] ✅ Saved successfully — ${cleanEntries.length} entries`);
          activeJobs.set(jobId, { status: "completed", result: `${cleanEntries.length} entries saved` });
        } catch (dbErr) {
          console.error("[Generate] DB save error:", dbErr.message);
          activeJobs.set(jobId, { status: "failed", error: "DB save failed: " + dbErr.message });
        }
      } else {
        activeJobs.set(jobId, { status: "failed", error: result.reason });
      }
    });
    
    worker.on("error", (error) => {
      activeJobs.set(jobId, { status: "failed", error: error.message });
    });
    
    worker.on("exit", (code) => {
      if (code !== 0 && activeJobs.get(jobId).status === "running") {
        activeJobs.set(jobId, { status: "failed", error: `Worker stopped with code ${code}` });
      }
    });

    res.json({ jobId, message: "Timetable generation started" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Poll generation status
// @route   GET /api/admin/timetable/generate/status/:jobId
// @access  Private/Admin
export const getGenerationStatus = (req, res) => {
  const { jobId } = req.params;
  const job = activeJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }
  
  res.json(job);
};

// @desc    Get timetable
// @route   GET /api/admin/timetable/:semester
// @access  Private/Admin
export const getTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ semester: req.params.semester })
            .populate("entries.courseId entries.facultyId entries.roomId entries.originalEntryId");
    
    if (timetable) {
      res.json(timetable);
    } else {
      res.status(404).json({ message: "Timetable not found for this semester" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get published timetable for authenticated users
// @route   GET /api/timetable/:semester
// @access  Private
export const getVisibleTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ semester: req.params.semester })
      .populate("entries.courseId entries.facultyId entries.roomId entries.originalEntryId");

    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found for this semester" });
    }

    if (req.user.role !== "admin" && timetable.status !== "published") {
      return res.status(404).json({ message: "Timetable has not been published yet" });
    }

    res.json(timetable);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Publish timetable
// @route   PATCH /api/admin/timetable/:semester/publish
// @access  Private/Admin
export const publishTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ semester: req.params.semester });
    
    if (timetable) {
      timetable.status = "published";
      timetable.publishedAt = Date.now();
      await timetable.save();
      
      // Also lock faculty preferences
      await FacultyPreference.updateMany({ semester: req.params.semester }, { isLocked: true });
      
      res.json(timetable);
    } else {
      res.status(404).json({ message: "Timetable not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

import { exportTimetablePDF, exportTimetableExcel } from "../utils/exporter.js";

// @desc    Export Timetable
// @route   GET /api/admin/timetable/:semester/export?format=pdf|excel&section=A
// @access  Private/Admin
export const exportTimetable = async (req, res) => {
  try {
    const { format, section } = req.query;
    const timetable = await Timetable.findOne({ semester: req.params.semester })
            .populate("entries.courseId entries.facultyId entries.roomId");
            
    if (!timetable) return res.status(404).json({ message: "Not found" });
    
    if (format === "excel") {
      exportTimetableExcel(res, timetable, section);
    } else {
      exportTimetablePDF(res, timetable, section);
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Manual Move Class
// @route   PATCH /api/admin/timetable/entry/:entryId/move
// @access  Private/Admin
export const moveTimetableEntry = async (req, res) => {
  try {
    const { entryId } = req.params;
    const { newDay, newPeriod, newRoomId } = req.body;
    
    const timetable = await Timetable.findOne({ "entries._id": entryId });
    if (!timetable) return res.status(404).json({ message: "Entry not found" });
    
    const entry = timetable.entries.id(entryId);
    
    // Validate Clash
    // Is faculty free?
    const facClash = timetable.entries.find(e => 
      e.day === newDay && e.period === newPeriod && 
      e.facultyId.toString() === entry.facultyId.toString() && 
      e._id.toString() !== entryId && !e.isCancelled
    );
    
    // Is room free?
    const roomClash = timetable.entries.find(e => 
      e.day === newDay && e.period === newPeriod && 
      e.roomId.toString() === newRoomId && 
      e._id.toString() !== entryId && !e.isCancelled
    );
    
    // Is section free?
    const secClash = timetable.entries.find(e => 
      e.day === newDay && e.period === newPeriod && 
      e.sectionId === entry.sectionId && 
      e._id.toString() !== entryId && !e.isCancelled
    );
     
    let clashReason = [];
    if (facClash) clashReason.push("Faculty already evaluating another class.");
    if (roomClash) clashReason.push("Room is occupied.");
    if (secClash) clashReason.push("Section is busy.");
    
    if (clashReason.length > 0) {
      return res.status(409).json({ message: "Conflict detected", details: clashReason.join(" ") });
    }
    
    entry.day = newDay;
    entry.period = newPeriod;
    entry.roomId = newRoomId;
    
    timetable.auditLog.push({
      changedBy: req.user._id,
      changeType: "manual_override",
      description: `Moved course ${entry.courseId} to ${newDay} period ${newPeriod}`
    });
    
    await timetable.save();
    
    res.json({ message: "Moved successfully", entry });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
