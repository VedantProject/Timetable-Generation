import FacultyPreference from "../models/FacultyPreference.js";
import InstitutionalConstraint from "../models/InstitutionalConstraint.js";
import Timetable from "../models/Timetable.js";

const FACULTY_RESCHEDULE_EXTRA_DAYS = ["Saturday"];
const asId = (value) => (value == null ? "" : value.toString());
const getLabBlockEntries = (entries, entry) => {
  const courseId = asId(entry.courseId);
  const facultyId = asId(entry.facultyId);

  return entries
    .filter(
      (candidate) =>
        candidate.isLab &&
        !candidate.isCancelled &&
        candidate.day === entry.day &&
        candidate.sectionId === entry.sectionId &&
        Number(candidate.year) === Number(entry.year) &&
        asId(candidate.courseId) === courseId &&
        asId(candidate.facultyId) === facultyId
    )
    .sort((a, b) => Number(a.period) - Number(b.period));
};

const getRelatedExtraEntries = (entries, entry) => {
  const originalEntryId = asId(entry.originalEntryId);
  const courseId = asId(entry.courseId);
  const facultyId = asId(entry.facultyId);

  return entries
    .filter(
      (candidate) =>
        candidate.isExtraClass &&
        candidate.day === entry.day &&
        candidate.sectionId === entry.sectionId &&
        Number(candidate.year) === Number(entry.year) &&
        asId(candidate.courseId) === courseId &&
        asId(candidate.facultyId) === facultyId &&
        (
          (originalEntryId && asId(candidate.originalEntryId) === originalEntryId) ||
          (!originalEntryId && !!candidate.isLab === !!entry.isLab)
        )
    )
    .sort((a, b) => Number(a.period) - Number(b.period));
};

const findFacultyRoom = ({
  entries,
  blockedEntryIds = [],
  rooms,
  isLab,
  newDay,
  targetPeriods,
  preferredRoomId,
}) => {
  const blockedIds = new Set(blockedEntryIds.map(asId));
  const orderedRooms = [...rooms].sort((a, b) => {
    if (asId(a._id) === asId(preferredRoomId)) return -1;
    if (asId(b._id) === asId(preferredRoomId)) return 1;
    return String(a.roomId || "").localeCompare(String(b.roomId || ""));
  });

  return (
    orderedRooms.find((room) =>
      !!room.isLab === !!isLab &&
      targetPeriods.every(
        (period) =>
          !entries.some(
            (candidate) =>
              !candidate.isCancelled &&
              !blockedIds.has(asId(candidate._id)) &&
              candidate.day === newDay &&
              Number(candidate.period) === Number(period) &&
              asId(candidate.roomId) === asId(room._id)
          )
      )
    ) || null
  );
};

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

// @desc    Schedule Extra Class
// @route   POST /api/faculty/timetable/extra-class
// @access  Private/Faculty
export const scheduleExtraClass = async (req, res) => {
  try {
    const { sourceEntryId, newDay, newPeriod, newRoomId } = req.body;

    const timetable = await Timetable.findOne({ "entries._id": sourceEntryId });
    if (!timetable) {
      return res.status(404).json({ message: "Source entry not found" });
    }

    const sourceEntry = timetable.entries.id(sourceEntryId);
    if (!sourceEntry) {
      return res.status(404).json({ message: "Source entry not found" });
    }

    if (asId(sourceEntry.facultyId) !== asId(req.user._id)) {
      return res.status(403).json({ message: "Not authorized to schedule an extra class for this entry." });
    }

    if (sourceEntry.isCancelled) {
      return res.status(400).json({ message: "Restore the class before using it as a template for an extra class." });
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
      return res.status(400).json({ message: "Selected day is outside the allowed schedule days." });
    }

    const periodsPerDay = Number(constraint.periodsPerDay) || 8;
    const breakPeriods = new Set((constraint.breakPeriods || []).map(Number));

    const sourceBlockEntries = sourceEntry.isLab ? getLabBlockEntries(timetable.entries, sourceEntry) : [sourceEntry];
    const duration = Math.max(sourceBlockEntries.length, 1);
    const targetPeriods = Array.from({ length: duration }, (_, index) => targetPeriod + index);

    if (targetPeriods.some((period) => period < 1 || period > periodsPerDay)) {
      return res.status(400).json({ message: "Selected slot exceeds the configured timetable periods." });
    }

    if (targetPeriods.some((period) => breakPeriods.has(period))) {
      return res.status(409).json({ message: "Extra classes cannot be placed in a break period." });
    }

    const allowedRooms = (constraint.rooms || []).filter((room) => !!room && !!room._id);
    const selectedRoom = allowedRooms.find((room) => asId(room._id) === asId(newRoomId));
    if (!selectedRoom) {
      return res.status(400).json({ message: "Selected room is not part of the configured timetable rooms." });
    }

    if (!!selectedRoom.isLab !== !!sourceEntry.isLab) {
      return res.status(409).json({
        message: sourceEntry.isLab
          ? "Please select a lab room for this extra lab."
          : "Please select a theory room for this extra class.",
      });
    }

    const facultyPreference = await FacultyPreference.findOne({
      facultyId: req.user._id,
      semester: timetable.semester,
    }).lean();

    const unavailablePeriod = targetPeriods.find((period) =>
      facultyPreference?.unavailableSlots?.some(
        (slot) => slot.day === newDay && Number(slot.period) === Number(period)
      )
    );

    if (unavailablePeriod) {
      return res.status(409).json({ message: `You marked ${newDay} period ${unavailablePeriod} as unavailable.` });
    }

    const activeEntries = timetable.entries.filter((entry) => !entry.isCancelled);

    const facultyClash = targetPeriods.find((period) =>
      activeEntries.some(
        (entry) =>
          entry.day === newDay &&
          Number(entry.period) === Number(period) &&
          asId(entry.facultyId) === asId(req.user._id)
      )
    );

    if (facultyClash) {
      return res.status(409).json({ message: `You already have another class on ${newDay} period ${facultyClash}.` });
    }

    const sectionClash = targetPeriods.find((period) =>
      activeEntries.some(
        (entry) =>
          entry.day === newDay &&
          Number(entry.period) === Number(period) &&
          entry.sectionId === sourceEntry.sectionId &&
          Number(entry.year) === Number(sourceEntry.year)
      )
    );

    if (sectionClash) {
      return res.status(409).json({
        message: `Students in section ${sourceEntry.sectionId} already have another class on ${newDay} period ${sectionClash}.`,
      });
    }

    const compatibleRoom = findFacultyRoom({
      entries: timetable.entries,
      rooms: allowedRooms,
      isLab: sourceEntry.isLab,
      newDay,
      targetPeriods,
      preferredRoomId: selectedRoom._id,
    });

    if (!compatibleRoom || asId(compatibleRoom._id) !== asId(selectedRoom._id)) {
      return res.status(409).json({
        message: sourceEntry.isLab
          ? "The selected lab room is not free for the full extra-class block."
          : "The selected room is occupied in that slot.",
      });
    }

    const newEntries = targetPeriods.map((period, index) => ({
      day: newDay,
      period,
      courseId: sourceEntry.courseId,
      sectionId: sourceEntry.sectionId,
      year: sourceEntry.year,
      facultyId: sourceEntry.facultyId,
      roomId: selectedRoom._id,
      isLab: sourceEntry.isLab,
      labBlock: sourceEntry.isLab ? index + 1 : undefined,
      isExtraClass: true,
      originalEntryId: sourceEntry._id,
    }));

    timetable.entries.push(...newEntries);
    timetable.auditLog.push({
      changedBy: req.user._id,
      changeType: "manual_override",
      description: `Extra class scheduled for ${sourceEntry.courseId} (${sourceEntry.sectionId}) on ${newDay} period ${targetPeriod}${duration > 1 ? `-${targetPeriod + duration - 1}` : ""}`,
    });

    await timetable.save();

    res.status(201).json({
      message:
        newDay === "Saturday"
          ? "Extra class scheduled successfully. Saturday was used as an allowed soft scheduling day."
          : "Extra class scheduled successfully.",
      newEntryIds: timetable.entries.slice(-newEntries.length).map((entry) => entry._id),
      usedSoftDay: newDay === "Saturday",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete Extra Class
// @route   DELETE /api/faculty/timetable/entry/:entryId/extra-class
// @access  Private/Faculty
export const deleteExtraClass = async (req, res) => {
  try {
    const { entryId } = req.params;
    const timetable = await Timetable.findOne({ "entries._id": entryId });
    if (!timetable) {
      return res.status(404).json({ message: "Extra class not found" });
    }

    const entry = timetable.entries.id(entryId);
    if (!entry || !entry.isExtraClass) {
      return res.status(404).json({ message: "Extra class not found" });
    }

    if (asId(entry.facultyId) !== asId(req.user._id)) {
      return res.status(403).json({ message: "Not authorized to delete this extra class." });
    }

    const entriesToRemove = entry.isLab ? getRelatedExtraEntries(timetable.entries, entry) : [entry];
    const removableEntries = entriesToRemove.length ? entriesToRemove : [entry];

    removableEntries.forEach((extraEntry) => {
      timetable.entries.pull(extraEntry._id);
    });

    timetable.auditLog.push({
      changedBy: req.user._id,
      changeType: "manual_override",
      description: `Deleted extra class for ${entry.courseId} (${entry.sectionId}) on ${entry.day} period ${entry.period}${removableEntries.length > 1 ? `-${entry.period + removableEntries.length - 1}` : ""}`,
    });

    await timetable.save();

    res.json({
      message: "Extra class deleted successfully",
      removedEntryIds: removableEntries.map((extraEntry) => extraEntry._id),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
