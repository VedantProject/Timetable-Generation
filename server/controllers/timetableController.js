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
const RESCHEDULE_EXTRA_DAYS = ["Saturday"];

// In-memory job queue for simplicity. In production, use Redis or a DB table for jobs.
const activeJobs = new Map();

const asId = (value) => (value == null ? "" : value.toString());

const getLabBlockEntries = (entries, entry) => {
  const courseId = asId(entry.courseId);
  const facultyId = asId(entry.facultyId);

  return entries
    .filter((candidate) =>
      candidate.isLab &&
      !candidate.isCancelled &&
      candidate.day === entry.day &&
      candidate.sectionId === entry.sectionId &&
      Number(candidate.year) === Number(entry.year) &&
      asId(candidate.courseId) === courseId &&
      asId(candidate.facultyId) === facultyId
    )
    .sort((a, b) => a.period - b.period);
};

const buildMoveContext = async (timetable, entry) => {
  const constraint = await InstitutionalConstraint.findOne({
    semester: timetable.semester,
    department: timetable.department,
  }).lean();

  if (!constraint) {
    return { error: { status: 400, message: "Constraints not found for this timetable" } };
  }

  const blockEntries = entry.isLab ? getLabBlockEntries(timetable.entries, entry) : [entry];
  const moveEntries = blockEntries.length ? blockEntries : [entry];
  const moveEntryIds = new Set(moveEntries.map((item) => asId(item._id)));

  const rooms = await Room.find({
    _id: { $in: constraint.rooms || [] },
    isLab: !!entry.isLab,
  }).lean();

  if (!rooms.length) {
    return {
      error: {
        status: 400,
        message: entry.isLab
          ? "No lab rooms are configured for this timetable"
          : "No theory rooms are configured for this timetable",
      },
    };
  }

  const facultyPreference = entry.facultyId
    ? await FacultyPreference.findOne({
        semester: timetable.semester,
        facultyId: entry.facultyId,
      }).lean()
    : null;

  return {
    constraint,
    rooms,
    facultyPreference,
    moveEntries,
    moveEntryIds,
  };
};

const findCompatibleRoom = ({
  entries,
  moveEntries,
  moveEntryIds,
  rooms,
  entry,
  newDay,
  newPeriod,
}) => {
  const orderedRooms = [...rooms].sort((a, b) => {
    if (asId(a._id) === asId(entry.roomId)) return -1;
    if (asId(b._id) === asId(entry.roomId)) return 1;
    return String(a.roomId || "").localeCompare(String(b.roomId || ""));
  });

  for (const room of orderedRooms) {
    const roomId = asId(room._id);
    const roomFitsWholeBlock = moveEntries.every((blockEntry, index) => {
      const targetPeriod = Number(newPeriod) + index;

      return !entries.some((candidate) =>
        !candidate.isCancelled &&
        !moveEntryIds.has(asId(candidate._id)) &&
        candidate.day === newDay &&
        Number(candidate.period) === targetPeriod &&
        asId(candidate.roomId) === roomId
      );
    });

    if (roomFitsWholeBlock) {
      return room;
    }
  }

  return null;
};

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
    const { newDay, newPeriod } = req.body;
    
    const timetable = await Timetable.findOne({ "entries._id": entryId });
    if (!timetable) return res.status(404).json({ message: "Entry not found" });
    
    const entry = timetable.entries.id(entryId);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    if (entry.isCancelled) {
      return res.status(400).json({ message: "Cancelled classes cannot be moved" });
    }

    if (entry.isLab && Number(entry.labBlock) > 1) {
      return res.status(400).json({ message: "Drag the first period of a lab block to reschedule the full lab" });
    }

    const targetPeriod = Number(newPeriod);
    if (!newDay || Number.isNaN(targetPeriod)) {
      return res.status(400).json({ message: "New day and period are required" });
    }

    const moveContext = await buildMoveContext(timetable, entry);
    if (moveContext.error) {
      return res.status(moveContext.error.status).json({ message: moveContext.error.message });
    }

    const {
      constraint,
      rooms,
      facultyPreference,
      moveEntries,
      moveEntryIds,
    } = moveContext;

    const workingDays = new Set([...(constraint.workingDays || []), ...RESCHEDULE_EXTRA_DAYS]);
    const periodsPerDay = Number(constraint.periodsPerDay) || 8;
    const breakPeriods = new Set((constraint.breakPeriods || []).map(Number));

    if (!workingDays.has(newDay)) {
      return res.status(400).json({ message: "Target day is outside the configured working days" });
    }

    const targetPeriods = moveEntries.map((_, index) => targetPeriod + index);
    if (targetPeriods.some((period) => period < 1 || period > periodsPerDay)) {
      return res.status(400).json({ message: "Target slot exceeds the configured periods for the day" });
    }

    if (targetPeriods.some((period) => breakPeriods.has(period))) {
      return res.status(409).json({ message: "Class cannot be moved into a break period" });
    }

    const unavailableSlot = targetPeriods.find((period) =>
      facultyPreference?.unavailableSlots?.some(
        (slot) => slot.day === newDay && Number(slot.period) === period
      )
    );

    if (unavailableSlot) {
      return res.status(409).json({
        message: `Faculty is unavailable on ${newDay} period ${unavailableSlot}`,
      });
    }

    const facClash = moveEntries.find((blockEntry, index) =>
      timetable.entries.some((candidate) =>
        !candidate.isCancelled &&
        !moveEntryIds.has(asId(candidate._id)) &&
        candidate.day === newDay &&
        Number(candidate.period) === targetPeriod + index &&
        asId(candidate.facultyId) === asId(blockEntry.facultyId)
      )
    );

    if (facClash) {
      return res.status(409).json({ message: "Faculty already has another class in the selected slot" });
    }

    const secClash = moveEntries.find((_, index) =>
      timetable.entries.some((candidate) =>
        !candidate.isCancelled &&
        !moveEntryIds.has(asId(candidate._id)) &&
        candidate.day === newDay &&
        Number(candidate.period) === targetPeriod + index &&
        candidate.sectionId === entry.sectionId &&
        Number(candidate.year) === Number(entry.year)
      )
    );

    if (secClash) {
      return res.status(409).json({ message: "Students in this section already have another class in that slot" });
    }

    const selectedRoom = findCompatibleRoom({
      entries: timetable.entries,
      moveEntries,
      moveEntryIds,
      rooms,
      entry,
      newDay,
      newPeriod: targetPeriod,
    });

    if (!selectedRoom) {
      return res.status(409).json({
        message: entry.isLab
          ? "No lab room is free for the full target block"
          : "No room is free for the selected slot",
      });
    }

    const samePlacement =
      entry.day === newDay &&
      Number(entry.period) === targetPeriod &&
      asId(entry.roomId) === asId(selectedRoom._id);

    if (samePlacement) {
      return res.json({ message: "Class is already scheduled in that slot", entry });
    }
    
    moveEntries.forEach((blockEntry, index) => {
      blockEntry.day = newDay;
      blockEntry.period = targetPeriod + index;
      blockEntry.roomId = selectedRoom._id;
    });
    
    timetable.auditLog.push({
      changedBy: req.user._id,
      changeType: "manual_override",
      description: `Moved course ${entry.courseId} (${entry.sectionId}) to ${newDay} period ${targetPeriod}${entry.isLab ? `-${targetPeriod + moveEntries.length - 1}` : ""} in room ${selectedRoom.roomId}`
    });
    
    await timetable.save();
    
    res.json({
      message: "Moved successfully",
      movedEntryIds: moveEntries.map((blockEntry) => blockEntry._id),
      roomId: selectedRoom.roomId,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
