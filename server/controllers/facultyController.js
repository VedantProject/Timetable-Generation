import FacultyPreference from "../models/FacultyPreference.js";
import InstitutionalConstraint from "../models/InstitutionalConstraint.js";

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

import Timetable from "../models/Timetable.js";

// @desc    Cancel Class
// @route   PATCH /api/faculty/timetable/entry/:entryId/cancel
// @access  Private/Faculty
export const cancelClass = async (req, res) => {
  try {
    const { entryId } = req.params;
    const timetable = await Timetable.findOne({ "entries._id": entryId });
    if (!timetable) return res.status(404).json({ message: "Entry not found" });
    
    const entry = timetable.entries.id(entryId);
    
    // Validate faculty ownership
    if (entry.facultyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to cancel this class." });
    }
    
    entry.isCancelled = !entry.isCancelled;
    
    timetable.auditLog.push({
      changedBy: req.user._id,
      changeType: "cancellation",
      description: `${entry.isCancelled ? "Cancelled" : "Restored"} course ${entry.courseId} on ${entry.day} period ${entry.period}`
    });
    
    await timetable.save();
    
    res.json({
      message: entry.isCancelled ? "Class canceled successfully" : "Class cancellation removed successfully",
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
    
    // Clash check
    const facClash = timetable.entries.find(e => e.day === newDay && e.period === newPeriod && e.facultyId.toString() === req.user._id.toString() && !e.isCancelled);
    const roomClash = timetable.entries.find(e => e.day === newDay && e.period === newPeriod && e.roomId.toString() === newRoomId && !e.isCancelled);
    const secClash = timetable.entries.find(e => e.day === newDay && e.period === newPeriod && e.sectionId === originalEntry.sectionId && !e.isCancelled);

    let clashReason = [];
    if (facClash) clashReason.push("Select a period where you are completely free.");
    if (roomClash) clashReason.push("Room is occupied.");
    if (secClash) clashReason.push("The section students are busy.");
    
    if (clashReason.length > 0) {
      return res.status(409).json({ message: "Conflict detected", details: clashReason.join(" ") });
    }
    
    const newEntry = {
      day: newDay,
      period: newPeriod,
      courseId: originalEntry.courseId,
      sectionId: originalEntry.sectionId,
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
      description: `Makeup class for ${originalEntry.courseId} scheduled on ${newDay} period ${newPeriod}`
    });
    
    await timetable.save();
    
    res.status(201).json({ message: "Makeup class scheduled", newEntry });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
