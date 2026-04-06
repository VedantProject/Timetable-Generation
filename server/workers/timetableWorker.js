import { parentPort, workerData } from "worker_threads";

/**
 * TIMETABLE GENERATION WORKER — Greedy Forward Assignment
 *
 * All ObjectIds are pre-stringified by the controller.
 *
 * Algorithm:
 *   For each batch (year+section), in order of year then section:
 *     1. Greedy lab allocation: find first day+period block that fits, preferring
 *        days with fewest existing allocations (week spread).
 *     2. Greedy theory allocation: distribute one period per course per day across
 *        the week before doubling up (bin-packing style).
 *        If a slot is blocked (faculty/room/section busy), try the next valid slot.
 *
 * Global state (facOccupied, roomOccupied) is shared across all batches so
 * that a faculty teaching both Year 2 and Year 3 is never double-booked.
 *
 * This runs in O(n*m) time (n=nodes, m=slots) — always finishes instantly.
 */

const { courses, rooms, constraints, facultyPreferences } = workerData;

// ── Logging ──────────────────────────────────────────────────────────────────
const log  = (...a) => process.stdout.write("[Worker] " + a.join(" ") + "\n");
const warn = (...a) => process.stderr.write("[Worker WARN] " + a.join(" ") + "\n");

log(`Courses: ${courses.length}, Rooms: ${rooms.length}`);
log(`Days: ${constraints.workingDays.join(", ")}`);
log(`Periods/day: ${constraints.periodsPerDay}, Breaks: ${JSON.stringify(constraints.breakPeriods)}`);

const labRooms    = rooms.filter(r => r.isLab);
const theoryRooms = rooms.filter(r => !r.isLab);
log(`Lab rooms: ${labRooms.length}, Theory rooms: ${theoryRooms.length}`);

// ── Faculty preference lookup ────────────────────────────────────────────────
const facPrefMap = {};
(facultyPreferences || []).forEach(fp => {
  if (fp.facultyId) facPrefMap[fp.facultyId] = fp;
});

const isFacultyHardBlocked = (facId, day, period) => {
  const prefs = facPrefMap[facId];
  if (!prefs) return false;
  return prefs.unavailableSlots?.some(s => s.day === day && s.period === period) || false;
};

// ── Build nodes from courses ─────────────────────────────────────────────────
const nodes = [];
courses.forEach(c => {
  c.sections.forEach(sec => {
    const facultyId = sec.assignedFacultyId || null;
    if (!facultyId) {
      warn(`Skip ${c.courseCode} Y${c.year} Sec${sec.sectionId} — no faculty`);
      return;
    }
    const batchId  = `${c.year}_${sec.sectionId}`;
    const courseId = c._id;
    const year     = Number(c.year);

    if (c.isLab && c.labDurationHours > 0) {
      nodes.push({ id: `${courseId}_${batchId}_lab`, courseId, sectionId: sec.sectionId, batchId, facultyId, year, isLab: true, hours: c.labDurationHours });
    }
    if (c.weeklyTheoryHours > 0) {
      for (let i = 0; i < c.weeklyTheoryHours; i++) {
        nodes.push({ id: `${courseId}_${batchId}_th${i}`, courseId, sectionId: sec.sectionId, batchId, facultyId, year, isLab: false, hours: 1 });
      }
    }
  });
});

log(`Nodes: ${nodes.length} (lab=${nodes.filter(n=>n.isLab).length}, theory=${nodes.filter(n=>!n.isLab).length})`);

// ── Slot helpers ─────────────────────────────────────────────────────────────
const workingDays   = constraints.workingDays;
const periodsPerDay = Number(constraints.periodsPerDay) || 8;
const breakSet      = new Set((constraints.breakPeriods || []).map(Number));

// All valid (day, period) slots, interleaved for week spread
// Pattern: Mon P1, Tue P1, Wed P1... then Mon P2, Tue P2...
const ALL_SLOTS = [];
for (let p = 1; p <= periodsPerDay; p++) {
  if (breakSet.has(p)) continue;
  for (const day of workingDays) {
    ALL_SLOTS.push({ day, period: p });
  }
}
log(`Valid slots: ${ALL_SLOTS.length}`);

// ── Global conflict state ────────────────────────────────────────────────────
const facOccupied  = {};  // [facId][day_P] = true
const roomOccupied = {};  // [roomId][day_P] = true
const secOccupied  = {};  // [batchId][day_P] = true

const key = (day, period) => `${day}_${period}`;

const occupy = (day, period, facId, batchId, roomId) => {
  const k = key(day, period);
  if (facId)   { if (!facOccupied[facId])    facOccupied[facId]   = {}; facOccupied[facId][k]   = true; }
  if (batchId) { if (!secOccupied[batchId])  secOccupied[batchId] = {}; secOccupied[batchId][k] = true; }
  if (roomId)  { if (!roomOccupied[roomId])  roomOccupied[roomId] = {}; roomOccupied[roomId][k] = true; }
};

const isSlotFree = (day, period, facId, batchId, roomId) => {
  const k = key(day, period);
  if (breakSet.has(period)) return false;
  if (facId   && facOccupied[facId]?.[k])   return false;
  if (facId   && isFacultyHardBlocked(facId, day, period)) return false;
  if (batchId && secOccupied[batchId]?.[k]) return false;
  if (roomId  && roomOccupied[roomId]?.[k]) return false;
  return true;
};

// ── Generation ───────────────────────────────────────────────────────────────
const generateTimetable = () => {
  const timetable = [];

  // Process batches in order: sort by year ASC, section ASC
  const batchIds = [...new Set(nodes.map(n => n.batchId))].sort((a, b) => {
    const [ay, as] = a.split("_");
    const [by, bs] = b.split("_");
    return Number(ay) - Number(by) || as.localeCompare(bs);
  });

  log(`Batches: ${batchIds.join(", ")}`);

  for (const batchId of batchIds) {
    const batchNodes = nodes.filter(n => n.batchId === batchId);
    const labNodes   = batchNodes.filter(n => n.isLab);
    const thNodes    = batchNodes.filter(n => !n.isLab);
    log(`\nBatch [${batchId}] — ${labNodes.length} labs, ${thNodes.length} theory`);

    // ── 1. Lab Allocation (greedy consecutive block) ──────────────────────
    for (const lab of labNodes) {
      let allocated = false;

      // Sort days: fewest existing section allocations first (spread across week)
      const dayOrder = [...workingDays].sort((a, b) => {
        const usedA = Object.keys(secOccupied[batchId] || {}).filter(k => k.startsWith(a + "_")).length;
        const usedB = Object.keys(secOccupied[batchId] || {}).filter(k => k.startsWith(b + "_")).length;
        return usedA - usedB;
      });

      outer:
      for (const day of dayOrder) {
        for (let start = 1; start <= periodsPerDay - lab.hours + 1; start++) {
          // Check no break in this block
          let hasBreak = false;
          for (let p = start; p < start + lab.hours; p++) {
            if (breakSet.has(p)) { hasBreak = true; break; }
          }
          if (hasBreak) continue;

          for (const room of labRooms) {
            // Check entire block is free
            let blockFree = true;
            for (let p = start; p < start + lab.hours; p++) {
              if (!isSlotFree(day, p, lab.facultyId, lab.batchId, room._id)) {
                blockFree = false; break;
              }
            }
            if (!blockFree) continue;

            // Allocate
            for (let i = 0; i < lab.hours; i++) {
              const p = start + i;
              occupy(day, p, lab.facultyId, lab.batchId, room._id);
              timetable.push({
                day, period: p, year: lab.year,
                courseId: lab.courseId, sectionId: lab.sectionId,
                facultyId: lab.facultyId, roomId: room._id,
                isLab: true, labBlock: i + 1
              });
            }
            log(`  ✓ Lab [${lab.id}] → ${day} P${start}-${start + lab.hours - 1} Rm:${room._id}`);
            allocated = true;
            break outer;
          }
        }
      }

      if (!allocated) {
        const msg = `Cannot allocate lab [${lab.id}] — fac=${lab.facultyId} batch=${lab.batchId} hours=${lab.hours}, labRooms=${labRooms.length}`;
        warn(msg);
        return { success: false, reason: msg };
      }
    }

    // ── 2. Theory Allocation (greedy, spread first) ──────────────────────
    // Group theory nodes by courseId so we don't dump same subject on same day
    const courseGroups = {};
    thNodes.forEach(n => {
      if (!courseGroups[n.courseId]) courseGroups[n.courseId] = [];
      courseGroups[n.courseId].push(n);
    });

    // Interleave nodes from different courses to maximise daily spread
    const interleavedNodes = [];
    const groups = Object.values(courseGroups);
    const maxLen = Math.max(...groups.map(g => g.length));
    for (let i = 0; i < maxLen; i++) {
      groups.forEach(g => { if (g[i]) interleavedNodes.push(g[i]); });
    }

    for (const node of interleavedNodes) {
      let allocated = false;

      // Try slots in "spread" order (interleaved across days)
      for (const slot of ALL_SLOTS) {
        // Find a free theory room
        for (const room of theoryRooms) {
          if (!isSlotFree(slot.day, slot.period, node.facultyId, node.batchId, room._id)) continue;

          occupy(slot.day, slot.period, node.facultyId, node.batchId, room._id);
          timetable.push({
            day: slot.day, period: slot.period, year: node.year,
            courseId: node.courseId, sectionId: node.sectionId,
            facultyId: node.facultyId, roomId: room._id,
            isLab: false
          });
          allocated = true;
          break;
        }
        if (allocated) break;
      }

      if (!allocated) {
        warn(`Skipping theory [${node.id}] — fac=${node.facultyId}, all ${ALL_SLOTS.length} slots exhausted. ` +
             `Possible: faculty fully booked across sections or not enough theory rooms (${theoryRooms.length}).`);
        // Continue rather than failing — generate a partial timetable
        // The slot will appear as FREE in the display
      }
    }

    const batchTotal = timetable.filter(e => e.sectionId === batchId.split("_")[1] && e.year === Number(batchId.split("_")[0])).length;
    log(`  ✓ Batch [${batchId}] done — ${batchTotal} slots`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  log(`\n🎉 Complete — ${timetable.length} total entries`);

  // Conflict verification
  let facConflicts = 0, roomConflicts = 0;
  const slotMap = {};
  timetable.forEach(e => {
    const k = `${e.day}_${e.period}`;
    if (!slotMap[k]) slotMap[k] = { facs: [], rooms: [] };
    if (e.facultyId) slotMap[k].facs.push(e.facultyId);
    slotMap[k].rooms.push(e.roomId);
  });
  Object.values(slotMap).forEach(s => {
    if (s.facs.length !== new Set(s.facs).size)  facConflicts++;
    if (s.rooms.length !== new Set(s.rooms).size) roomConflicts++;
  });
  log(`Conflicts — faculty: ${facConflicts}, rooms: ${roomConflicts}`);

  // Per-batch summary
  const batches = [...new Set(timetable.map(e => `Year${e.year}_${e.sectionId}`))].sort();
  batches.forEach(b => {
    const [yr, sec] = b.replace("Year", "").split("_");
    const count = timetable.filter(e => e.year === Number(yr) && e.sectionId === sec).length;
    log(`  Year ${yr} Section ${sec}: ${count} slots`);
  });

  return { success: true, timetable };
};

const result = generateTimetable();
parentPort.postMessage(result);
