import { parentPort, workerData } from "worker_threads";

/**
 * TIMETABLE GENERATION WORKER — Complete DB-driven implementation
 * 
 * All ObjectIds are pre-stringified by the controller before passing here.
 * 
 * Algorithm:
 *  1. Build "nodes" — one per (course × section × weekly_occurrence)
 *  2. Group nodes into batches by (year_section)
 *  3. Greedy lab allocation per batch (spread across days)
 *  4. Backtracking theory allocation per batch
 *  5. Global state tracks faculty & room conflicts across ALL sections
 *     so a shared faculty member cannot be double-booked
 * 
 * Key insight: faculty conflict is GLOBAL (shared across batches)
 *              section conflict is LOCAL to each batch
 *              room conflict is GLOBAL
 */

const { courses, rooms, constraints, facultyPreferences } = workerData;

// ── Debug logging ────────────────────────────────────────────────────────────
const log = (...args) => process.stdout.write("[WORKER] " + args.join(" ") + "\n");
const warn = (...args) => process.stderr.write("[WORKER WARN] " + args.join(" ") + "\n");

log(`Received ${courses.length} courses, ${rooms.length} rooms`);
log(`Working days: ${constraints.workingDays.join(", ")}`);
log(`Periods/day: ${constraints.periodsPerDay}, Break periods: ${constraints.breakPeriods}`);

const labRooms    = rooms.filter(r => r.isLab);
const theoryRooms = rooms.filter(r => !r.isLab);
log(`Lab rooms: ${labRooms.length}, Theory rooms: ${theoryRooms.length}`);

// ── Faculty preference lookup ────────────────────────────────────────────────
const facPrefMap = {};
(facultyPreferences || []).forEach(fp => {
  if (fp.facultyId) facPrefMap[fp.facultyId] = fp;
});

const isFacultyAvailable = (facId, day, period) => {
  const prefs = facPrefMap[facId];
  if (!prefs) return true;
  return !prefs.unavailableSlots?.some(s => s.day === day && s.period === period);
};

const prefScore = (facId, day, period) => {
  const prefs = facPrefMap[facId];
  if (!prefs) return 0;
  return prefs.preferredSlots?.some(s => s.day === day && s.period === period) ? 1 : 0;
};

// ── Build nodes ──────────────────────────────────────────────────────────────
const nodes = [];
courses.forEach(c => {
  c.sections.forEach(sec => {
    const facultyId = sec.assignedFacultyId || null;
    const batchId   = `${c.year}_${sec.sectionId}`;
    const courseId  = c._id;

    if (!facultyId) {
      warn(`Skipping ${c.courseCode} section ${sec.sectionId} (Year ${c.year}) — no faculty assigned`);
      return;
    }

    // Lab node (one per course per section)
    if (c.isLab && c.labDurationHours > 0) {
      nodes.push({
        id:        `${courseId}_${batchId}_lab`,
        courseId,  sectionId: sec.sectionId, batchId, facultyId,
        isLab: true, hours: c.labDurationHours
      });
    }

    // Theory nodes (one per weekly hour)
    if (c.weeklyTheoryHours > 0) {
      for (let i = 0; i < c.weeklyTheoryHours; i++) {
        nodes.push({
          id:       `${courseId}_${batchId}_th${i}`,
          courseId, sectionId: sec.sectionId, batchId, facultyId,
          isLab: false, hours: 1
        });
      }
    }
  });
});

log(`Total nodes: ${nodes.length} (labs: ${nodes.filter(n=>n.isLab).length}, theory: ${nodes.filter(n=>!n.isLab).length})`);

// ── Slot helpers ─────────────────────────────────────────────────────────────
const workingDays   = constraints.workingDays;
const periodsPerDay = Number(constraints.periodsPerDay) || 8;
const breakSet      = new Set((constraints.breakPeriods || []).map(Number));

/**
 * Generate all valid (day, period) slots, interleaved so that
 * Mon P1, Tue P1, Wed P1... appear before Mon P2, Tue P2...
 * This distributes classes naturally across the week.
 */
const buildAllSlots = () => {
  const slots = [];
  for (let p = 1; p <= periodsPerDay; p++) {
    if (breakSet.has(p)) continue;
    for (const day of workingDays) {
      slots.push({ day, period: p });
    }
  }
  return slots;
};
const ALL_SLOTS = buildAllSlots();
log(`Valid slots (excluding breaks): ${ALL_SLOTS.length}`);

// ── Global state matrices ────────────────────────────────────────────────────
// These track conflicts ACROSS all sections (faculty & room are global resources)
const facOccupied  = {};   // facOccupied[facId][day_P] = true
const roomOccupied = {};   // roomOccupied[roomId][day_P] = true
const secOccupied  = {};   // secOccupied[batchId][day_P] = true

const slotKey = (day, period) => `${day}_${period}`;

const occupy = (day, period, facId, batchId, roomId, val = true) => {
  const k = slotKey(day, period);
  if (facId) {
    if (!facOccupied[facId])  facOccupied[facId]  = {};
    facOccupied[facId][k] = val;
  }
  if (!secOccupied[batchId]) secOccupied[batchId] = {};
  secOccupied[batchId][k] = val;
  if (!roomOccupied[roomId]) roomOccupied[roomId] = {};
  roomOccupied[roomId][k] = val;
};

const isFree = (day, period, facId, batchId, roomId) => {
  const k = slotKey(day, period);
  if (breakSet.has(period)) return false;
  if (facId && facOccupied[facId]?.[k]) return false;
  if (facId && !isFacultyAvailable(facId, day, period)) return false;
  if (secOccupied[batchId]?.[k]) return false;
  if (roomOccupied[roomId]?.[k]) return false;
  return true;
};

// ── Main generation ──────────────────────────────────────────────────────────
const generateTimetable = () => {
  const timetable = [];

  // Process batches in deterministic order (year ASC, section ASC)
  const batchIds = [...new Set(nodes.map(n => n.batchId))].sort();
  log(`Batches to schedule: ${batchIds.join(", ")}`);

  for (const batchId of batchIds) {
    log(`\n── Scheduling batch: ${batchId} ──`);
    const batchNodes = nodes.filter(n => n.batchId === batchId);
    const labNodes   = batchNodes.filter(n => n.isLab);
    const thNodes    = batchNodes.filter(n => !n.isLab);
    log(`  Labs=${labNodes.length}, Theory=${thNodes.length}`);

    // ── 1. Lab allocation (greedy, consecutive block) ──────────────────────
    for (const lab of labNodes) {
      let allocated = false;
      const reasons = [];

      // Sort days by least used (spread labs across the week)
      const dayOrder = [...workingDays].sort((a, b) => {
        const usedA = Object.keys(secOccupied[batchId] || {}).filter(k => k.startsWith(a + "_")).length;
        const usedB = Object.keys(secOccupied[batchId] || {}).filter(k => k.startsWith(b + "_")).length;
        return usedA - usedB;
      });

      outer:
      for (const day of dayOrder) {
        // Try starting positions for a consecutive block of `lab.hours` periods
        for (let start = 1; start <= periodsPerDay - lab.hours + 1; start++) {
          // Check no break falls inside this block
          let blockHasBreak = false;
          for (let p = start; p < start + lab.hours; p++) {
            if (breakSet.has(p)) { blockHasBreak = true; break; }
          }
          if (blockHasBreak) continue;

          for (const room of labRooms) {
            let blockFree = true;
            for (let p = start; p < start + lab.hours; p++) {
              if (!isFree(day, p, lab.facultyId, lab.batchId, room._id)) {
                blockFree = false;
                reasons.push(`${day} P${p}`);
                break;
              }
            }
            if (!blockFree) continue;

            // Allocate entire block
            for (let block = 0; block < lab.hours; block++) {
              const p = start + block;
              occupy(day, p, lab.facultyId, lab.batchId, room._id, true);
              timetable.push({
                day, period: p,
                courseId:  lab.courseId,
                sectionId: lab.sectionId,
                facultyId: lab.facultyId,
                roomId:    room._id,
                isLab:     true,
                labBlock:  block + 1
              });
            }
            log(`  ✅ Lab [${lab.id}] → ${day} P${start}-${start+lab.hours-1} Room:${room._id}`);
            allocated = true;
            break outer;
          }
        }
      }

      if (!allocated) {
        const msg = `Cannot allocate lab [${lab.id}]: all slots blocked. Sample reasons: ${[...new Set(reasons)].slice(0,5).join("; ")}. ` +
                    `Lab rooms available=${labRooms.length}.`;
        warn(msg);
        return { success: false, reason: msg };
      }
    }

    // ── 2. Theory allocation (backtracking) ────────────────────────────────
    // Sort nodes so most-constrained faculty (fewest free slots) is scheduled first
    // This dramatically reduces backtracking depth
    const countFreeSlots = (facId, bid) =>
      ALL_SLOTS.filter(s => isFree(s.day, s.period, facId, bid, theoryRooms[0]?._id)).length;

    thNodes.sort((a, b) => countFreeSlots(a.facultyId, batchId) - countFreeSlots(b.facultyId, batchId));

    const sortedSlotsForNode = (node) => {
      return [...ALL_SLOTS].sort((a, b) => {
        // Prefer faculty's preferred slots, then spread evenly
        const prefA = prefScore(node.facultyId, a.day, a.period);
        const prefB = prefScore(node.facultyId, b.day, b.period);
        if (prefB !== prefA) return prefB - prefA;
        // Secondary: prefer days with fewer classes for this batch (spread)
        const usedA = Object.keys(secOccupied[batchId] || {}).filter(k => k.startsWith(a.day + "_")).length;
        const usedB = Object.keys(secOccupied[batchId] || {}).filter(k => k.startsWith(b.day + "_")).length;
        return usedA - usedB;
      });
    };

    const backtrack = (idx) => {
      if (idx === thNodes.length) return true;
      const node   = thNodes[idx];
      const slots  = sortedSlotsForNode(node);

      for (const slot of slots) {
        for (const room of theoryRooms) {
          if (!isFree(slot.day, slot.period, node.facultyId, node.batchId, room._id)) continue;

          // Assign
          occupy(slot.day, slot.period, node.facultyId, node.batchId, room._id, true);
          timetable.push({
            day:       slot.day,
            period:    slot.period,
            courseId:  node.courseId,
            sectionId: node.sectionId,
            facultyId: node.facultyId,
            roomId:    room._id,
            isLab:     false
          });

          if (backtrack(idx + 1)) return true;

          // Undo
          occupy(slot.day, slot.period, node.facultyId, node.batchId, room._id, false);
          timetable.pop();
        }
      }
      return false;  // No valid assignment found for this node
    };

    if (!backtrack(0)) {
      const totalSlots = ALL_SLOTS.length;
      const msg = `Backtracking failed for batch [${batchId}]. ` +
                  `Theory nodes=${thNodes.length}, valid_slots=${totalSlots}, theory_rooms=${theoryRooms.length}. ` +
                  `Hint: reduce weekly theory hours or add more rooms.`;
      warn(msg);
      return { success: false, reason: msg };
    }

    log(`  ✅ Batch [${batchId}] complete — ${timetable.filter(e => e.sectionId === batchId.split("_")[1]).length} entries (this batch)`);
  }

  log(`\n🎉 Generation complete — total entries: ${timetable.length}`);

  // Summary by batch
  const batches = [...new Set(timetable.map(e => e.sectionId))];
  batches.forEach(s => {
    const count = timetable.filter(e => e.sectionId === s).length;
    log(`  Section ${s}: ${count} slots`);
  });

  return { success: true, timetable };
};

const result = generateTimetable();
parentPort.postMessage(result);
