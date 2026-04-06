import { parentPort, workerData } from "worker_threads";

// workerData contains: courses, rooms, constraints, facultyPreferences

const { courses, rooms, constraints, facultyPreferences } = workerData;

// Deep copy of preferences for fast lookup
const facPrefMap = {}; 
facultyPreferences.forEach(fp => {
  facPrefMap[fp.facultyId?.toString()] = fp;
});

const isFacultyAvailable = (facId, day, period) => {
  const prefs = facPrefMap[facId];
  if (!prefs) return true;
  // Check hard constraints
  return !prefs.unavailableSlots.some(s => s.day === day && s.period === period);
};

const getFacultyPreferenceScore = (facId, day, period) => {
  const prefs = facPrefMap[facId];
  if (!prefs) return 0;
  return prefs.preferredSlots.some(s => s.day === day && s.period === period) ? 1 : 0;
};

// Flatten to Node list
const nodes = [];
courses.forEach(c => {
  c.sections.forEach(sec => {
    // Labs
    if (c.isLab && c.labDurationHours > 0) {
      nodes.push({
        id: `${c._id?.toString()}_${sec.sectionId}_lab`,
        courseId: c._id?.toString(),
        sectionId: sec.sectionId,
        batchId: `${c.year}_${sec.sectionId}`,
        facultyId: sec.assignedFacultyId?.toString(),
        isLab: true,
        hours: c.labDurationHours,
      });
    }
    // Theory
    if (c.weeklyTheoryHours > 0) {
      for (let i = 0; i < c.weeklyTheoryHours; i++) {
        nodes.push({
          id: `${c._id?.toString()}_${sec.sectionId}_theory_${i}`,
          courseId: c._id?.toString(),
          sectionId: sec.sectionId,
          batchId: `${c.year}_${sec.sectionId}`,
          facultyId: sec.assignedFacultyId?.toString(),
          isLab: false,
          hours: 1
        });
      }
    }
  });
});

const generateTimetable = () => {
  const timetable = [];
  
  // Track allocations: slotKey = day_period
  // State maps: 
  const facState = {};
  const secState = {}; // this will now use batchId
  const roomState = {};

  const markAllocated = (day, period, facId, batchId, roomId, val = true) => {
    const slotKey = `${day}_${period}`;
    if (facId && !facState[facId]) facState[facId] = {};
    if (!secState[batchId]) secState[batchId] = {};
    if (!roomState[roomId]) roomState[roomId] = {};
    
    if (facId) facState[facId][slotKey] = val;
    secState[batchId][slotKey] = val;
    roomState[roomId][slotKey] = val;
  };

  const isSlotFree = (day, period, facId, batchId, roomId) => {
    const slotKey = `${day}_${period}`;
    if (facId && facState[facId]?.[slotKey]) return false;
    if (secState[batchId]?.[slotKey]) return false;
    if (roomState[roomId]?.[slotKey]) return false;
    // Check faculty hard constraint
    if (facId && !isFacultyAvailable(facId, day, period)) return false;
    
    // Check breaks
    if (constraints.breakPeriods.includes(period)) return false;
    
    return true;
  };

  // Step 2: Lab Allocations (Greedy Continuous Blocks)
  const labNodes = nodes.filter(n => n.isLab);
  
  for (const lab of labNodes) {
    let allocated = false;
    let failureReasons = new Set();
    const availableLabRooms = rooms.filter(r => r.isLab);
    
    // Find consecutive block
    for (const day of constraints.workingDays) {
      for (let pClimb = 1; pClimb <= constraints.periodsPerDay - lab.hours + 1; pClimb++) {
        
        // Find a room 
        for (const r of availableLabRooms) {
          let canFit = true;
          const roomIdStr = r._id?.toString();
          for (let p = pClimb; p < pClimb + lab.hours; p++) {
             if (!isSlotFree(day, p, lab.facultyId, lab.batchId, roomIdStr)) {
               canFit = false;
               failureReasons.add(`P${p} blocked`);
               break;
             }
          }
          
          if (canFit) {
            // Allocate
            for (let block = 1; block <= lab.hours; block++) {
              let p = pClimb + block - 1;
              markAllocated(day, p, lab.facultyId, lab.batchId, roomIdStr, true);
              timetable.push({
                day, period: p,
                courseId: lab.courseId,
                sectionId: lab.sectionId,
                facultyId: lab.facultyId,
                roomId: roomIdStr,
                isLab: true,
                labBlock: block
              });
            }
            allocated = true;
            break;
          }
        }
        if (allocated) break;
      }
      if (allocated) break;
    }
    
    if (!allocated) {
      const dbg = `fac=${lab.facultyId}, batch=${lab.batchId}, hours=${lab.hours}. Rooms checked=${availableLabRooms.length}. Reasons=${[...failureReasons].join(', ')}`;
      console.log(`Failed for lab ${lab.courseId}_${lab.sectionId}: ` + dbg);
      return { success: false, reason: `Could not allocate lab block for ${lab.courseId.toString()}_${lab.sectionId}_lab. ${dbg}` };
    }
  }

  // Step 3: Theory Nodes (Backtracking)
  const theoryNodes = nodes.filter(n => !n.isLab);
  
  // Sort theory nodes by mostly constrained first? (Just random/sequential for now)
  const availableTheoryRooms = rooms.filter(r => !r.isLab);

  // All possible slots
  const allSlots = [];
  constraints.workingDays.forEach(day => {
    for (let p = 1; p <= constraints.periodsPerDay; p++) {
      allSlots.push({ day, period: p });
    }
  });

  const backtrack = (index) => {
    if (index === theoryNodes.length) return true; // All assigned
    const node = theoryNodes[index];

    // Sort slots by faculty preference (1 first, 0 next)
    const preferredOrderSlots = [...allSlots].sort((a, b) => {
      return getFacultyPreferenceScore(node.facultyId, b.day, b.period) - getFacultyPreferenceScore(node.facultyId, a.day, a.period);
    });

    for (const slot of preferredOrderSlots) {
      // Find a room
      for (const r of availableTheoryRooms) {
        const roomIdStr = r._id?.toString();
        if (isSlotFree(slot.day, slot.period, node.facultyId, node.batchId, roomIdStr)) {
          // Assign
          markAllocated(slot.day, slot.period, node.facultyId, node.batchId, roomIdStr, true);
          timetable.push({
            day: slot.day,
            period: slot.period,
            courseId: node.courseId,
            sectionId: node.sectionId,
            facultyId: node.facultyId,
            roomId: roomIdStr,
            isLab: false
          });

          if (backtrack(index + 1)) return true;

          // Backtrack
          markAllocated(slot.day, slot.period, node.facultyId, node.batchId, roomIdStr, false);
          timetable.pop();
        }
      }
    }
    return false;
  };

  const success = backtrack(0);
  if (success) {
    return { success: true, timetable };
  } else {
    return { success: false, reason: "Backtracking could not find a full theory allocation (Unsatisfiable constraints or extremely tight schedule)." }
  }
};

const result = generateTimetable();
parentPort.postMessage(result);
