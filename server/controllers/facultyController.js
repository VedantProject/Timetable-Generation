import FacultyPreference from "../models/FacultyPreference.js";
import InstitutionalConstraint from "../models/InstitutionalConstraint.js";
import Timetable from "../models/Timetable.js";

const FACULTY_RESCHEDULE_EXTRA_DAYS = ["Saturday"];
const asId = (value) => (value == null ? "" : value.toString());

// @desc    Get my preferences
// @route   GET /api/faculty/preferences/:semester
// @access  Private/Faculty
export const getMyPreferences = async (req, res) => {
  try {
    const preferences = await FacultyPreference.findOne({
      facultyId: req.user._id,
      semester: req.params.semester,
    });
    
    // We return an empty object if no preferences exist yet
    res.json(preferences || {});
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Submit preferences
// @route   POST /api/faculty/preferences
// @access  Private/Faculty
export const submitPreferences = async (req, res) => {
  try {
    const { semester, maxWeeklyHours, unavailableSlots, preferredSlots } = req.body;

    let preferences = await FacultyPreference.findOne({
      facultyId: req.user._id,
      semester,
    });

    if (preferences && preferences.isLocked) {
      return res.status(403).json({ message: "Preference submission window is locked." });
    }

    if (preferences) {
      preferences.maxWeeklyHours = maxWeeklyHours;
      preferences.unavailableSlots = unavailableSlots;
      preferences.preferredSlots = preferredSlots;
      await preferences.save();
    } else {
      preferences = await FacultyPreference.create({
        facultyId: req.user._id,
        semester,
        maxWeeklyHours,
        unavailableSlots,
        preferredSlots,
      });
    }

    res.json(preferences);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Cancel Class
// @route   PATCH /api/faculty/timetable/entry/:entryId/cancel
// @access  Private/Faculty
export const cancelClass = async (req, res) => {
  try {
    const { entryId } = req.params;
    const timetable = await Timetable.findOne({ "entries._id": entryId });
    if (!timetable) return res.status(404).json({ message: "Entry not found" });
    
    const entry = timetable.entries.id(entryId);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    if (entry.isMakeup) {
      return res.status(400).json({ message: "Makeup classes cannot be cancelled from this action." });
    }
    
    // Validate faculty ownership
    if (entry.facultyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to cancel this class." });
    }
    
    entry.isCancelled = !entry.isCancelled;

    let removedMakeupCount = 0;
    if (!entry.isCancelled) {
      const linkedMakeupEntries = timetable.entries.filter(
        (candidate) =>
          candidate.isMakeup &&
          asId(candidate.originalEntryId) === asId(entry._id)
      );

      linkedMakeupEntries.forEach((makeupEntry) => {
        timetable.entries.pull(makeupEntry._id);
      });

      removedMakeupCount = linkedMakeupEntries.length;
    }
    
    timetable.auditLog.push({
      changedBy: req.user._id,
      changeType: "cancellation",
      description: `${entry.isCancelled ? "Cancelled" : "Restored"} course ${entry.courseId} on ${entry.day} period ${entry.period}${
        removedMakeupCount ? ` and removed ${removedMakeupCount} linked makeup class${removedMakeupCount > 1 ? "es" : ""}` : ""
      }`
    });
    
    await timetable.save();
    
    res.json({
      message: entry.isCancelled
        ? "Class canceled successfully"
        : removedMakeupCount
        ? "Class cancellation removed and linked makeup deleted successfully"
        : "Class cancellation removed successfully",
      removedMakeupCount,
      entry
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get faculty-visible constraints
// @route   GET /api/faculty/constraints/:semester
// @access  Private/Faculty
export const getFacultyConstraints = async (req, res) => {
  try {
    const constraint = await InstitutionalConstraint.findOne({
      semester: req.params.semester,
    }).populate("rooms");

    if (constraint) {
      res.json(constraint);
    } else {
      res.status(404).json({ message: "Constraints not found for this semester" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Makeup Class
// @route   POST /api/faculty/timetable/makeup
// @access  Private/Faculty
export const makeupClass = async (req, res) => {
  try {
    const { originalEntryId, newDay, newPeriod, newRoomId } = req.body;
    
    const timetable = await Timetable.findOne({ "entries._id": originalEntryId });
    if (!timetable) return res.status(404).json({ message: "Original entry not found" });
    
    const originalEntry = timetable.entries.id(originalEntryId);
    
    if (originalEntry.facultyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to reschedule this class." });
    }
    
    if (!originalEntry.isCancelled) {
      return res.status(400).json({ message: "Original class must be cancelled first." });
    }

    const existingMakeup = timetable.entries.find(
      (entry) =>
        entry.isMakeup &&
        asId(entry.originalEntryId) === asId(originalEntry._id)
    );

    if (existingMakeup) {
      return res.status(409).json({
        message: "This cancelled class has already been rescheduled once.",
        details: "Remove the existing makeup by restoring the cancelled class first if you need to change it.",
      });
    }

    const targetPeriod = Number(newPeriod);
    if (!newDay || Number.isNaN(targetPeriod) || !newRoomId) {
      return res.status(400).json({ message: "Day, period, and room are required." });
    }

    const constraint = await InstitutionalConstraint.findOne({
      semester: timetable.semester,
      department: timetable.department,
    }).populate("rooms");

    if (!constraint) {
      return res.status(400).json({ message: "Constraints not found for this timetable." });
    }

    const validDays = new Set([...(constraint.workingDays || []), ...FACULTY_RESCHEDULE_EXTRA_DAYS]);
    if (!validDays.has(newDay)) {
      return res.status(400).json({ message: "Selected day is outside the allowed reschedule days." });
    }

    const periodsPerDay = Number(constraint.periodsPerDay) || 8;
    const breakPeriods = new Set((constraint.breakPeriods || []).map(Number));

    if (targetPeriod < 1 || targetPeriod > periodsPerDay) {
      return res.status(400).json({ message: "Selected period is outside the configured timetable." });
    }

    if (breakPeriods.has(targetPeriod)) {
      return res.status(409).json({ message: "Classes cannot be rescheduled into a break period." });
    }

    const allowedRoom = (constraint.rooms || []).find((room) => asId(room._id) === asId(newRoomId));
    if (!allowedRoom) {
      return res.status(400).json({ message: "Selected room is not part of the configured timetable rooms." });
    }

    if (!!allowedRoom.isLab !== !!originalEntry.isLab) {
      return res.status(409).json({
        message: originalEntry.isLab
          ? "Please select a lab room for this lab class."
          : "Please select a theory room for this class.",
      });
    }

    const facultyPreference = await FacultyPreference.findOne({
      facultyId: req.user._id,
      semester: timetable.semester,
    }).lean();

    const facultyUnavailable = facultyPreference?.unavailableSlots?.some(
      (slot) => slot.day === newDay && Number(slot.period) === targetPeriod
    );

    if (facultyUnavailable) {
      return res.status(409).json({ message: `You marked ${newDay} period ${targetPeriod} as unavailable.` });
    }

    const activeEntries = timetable.entries.filter((entry) => !entry.isCancelled);

    const facClash = activeEntries.find(
      (entry) =>
        entry.day === newDay &&
        Number(entry.period) === targetPeriod &&
        asId(entry.facultyId) === asId(req.user._id)
    );
    const roomClash = activeEntries.find(
      (entry) =>
        entry.day === newDay &&
        Number(entry.period) === targetPeriod &&
        asId(entry.roomId) === asId(newRoomId)
    );
    const secClash = activeEntries.find(
      (entry) =>
        entry.day === newDay &&
        Number(entry.period) === targetPeriod &&
        entry.sectionId === originalEntry.sectionId &&
        Number(entry.year) === Number(originalEntry.year)
    );

    const clashReason = [];
    if (facClash) clashReason.push("You already have another class in that slot.");
    if (roomClash) clashReason.push("The selected room is occupied.");
    if (secClash) clashReason.push("The section students already have another class in that slot.");

    if (clashReason.length > 0) {
      return res.status(409).json({ message: "Conflict detected", details: clashReason.join(" ") });
    }
    
    const newEntry = {
      day: newDay,
      period: targetPeriod,
      courseId: originalEntry.courseId,
      sectionId: originalEntry.sectionId,
      year: originalEntry.year,
      facultyId: originalEntry.facultyId,
      roomId: newRoomId,
      isLab: originalEntry.isLab,
      isMakeup: true,
      originalEntryId: originalEntry._id
    };
    
    timetable.entries.push(newEntry);
    
    timetable.auditLog.push({
      changedBy: req.user._id,
      changeType: "makeup",
      description: `Makeup class for ${originalEntry.courseId} scheduled on ${newDay} period ${targetPeriod}`
    });
    
    await timetable.save();

    res.status(201).json({
      message: "Makeup class scheduled successfully",
      newEntryId: timetable.entries[timetable.entries.length - 1]?._id,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
