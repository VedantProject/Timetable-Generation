import mongoose from "mongoose";
import dotenv from "dotenv";
import Course from "./models/Course.js";
import InstitutionalConstraint from "./models/InstitutionalConstraint.js";
import Room from "./models/Room.js";

dotenv.config();

const testGen = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const semester = "Fall 2024";
    const department = "CSE";
    
    const constraints = await InstitutionalConstraint.findOne({ semester, department });
    const courses = await Course.find({ department }).lean();
    const rooms = await Room.find({ _id: { $in: constraints.rooms } }).lean();
    
    // Removed earlier duplicate node definition
    // console.log("Lab Nodes:");
    // nodes.filter(n => n.isLab).forEach(n => console.log(n));

    // Start Inline Algorithm
    const facultyPreferences = [];
    
    const facPrefMap = {}; 
    const isFacultyAvailable = (facId, day, period) => true;
    const getFacultyPreferenceScore = (facId, day, period) => 0;

    const nodes = [];
    courses.forEach(c => {
      c.sections.forEach(sec => {
        if (c.isLab && c.labDurationHours > 0) {
          nodes.push({ id: `${c._id}_${sec.sectionId}_lab`, courseId: c._id, sectionId: sec.sectionId, batchId: `${c.year}_${sec.sectionId}`, facultyId: sec.assignedFacultyId, isLab: true, hours: c.labDurationHours });
        }
        if (c.weeklyTheoryHours > 0) {
          for (let i = 0; i < c.weeklyTheoryHours; i++) {
            nodes.push({ id: `${c._id}_${sec.sectionId}_theory_${i}`, courseId: c._id, sectionId: sec.sectionId, batchId: `${c.year}_${sec.sectionId}`, facultyId: sec.assignedFacultyId, isLab: false, hours: 1 });
          }
        }
      });
    });

    const timetable = [];
    const facState = {}; const secState = {}; const roomState = {};

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
      if (facId && facState[facId]?.[slotKey]) return { free: false, reason: 'fac' };
      if (secState[batchId]?.[slotKey]) return { free: false, reason: 'batch' };
      if (roomState[roomId]?.[slotKey]) return { free: false, reason: 'room' };
      if (constraints.breakPeriods.includes(period)) return { free: false, reason: 'break' };
      return { free: true };
    };

    const labNodes = nodes.filter(n => n.isLab);
    console.log(`Trying to fit ${labNodes.length} labs`);
    const availableLabRooms = rooms.filter(r => r.isLab);

    for (const lab of labNodes) {
      let allocated = false;
      for (const day of constraints.workingDays) {
        for (let pClimb = 1; pClimb <= constraints.periodsPerDay - lab.hours + 1; pClimb++) {
          for (const r of availableLabRooms) {
            let canFit = true;
            let blockReason = '';
            for (let p = pClimb; p < pClimb + lab.hours; p++) {
               let check = isSlotFree(day, p, lab.facultyId, lab.batchId, r._id);
               if (!check.free) { canFit = false; blockReason = check.reason; break; }
            }
            if (canFit) {
              for (let block = 1; block <= lab.hours; block++) {
                let p = pClimb + block - 1;
                markAllocated(day, p, lab.facultyId, lab.batchId, r._id, true);
                timetable.push({ day, period: p, courseId: lab.courseId, sectionId: lab.sectionId, isLab: true });
              }
              allocated = true; break;
            }
          }
          if (allocated) break;
        }
        if (allocated) break;
      }
      if (!allocated) {
        console.log(`Failed lab: batch=${lab.batchId}, fac=${lab.facultyId}. Room count=${availableLabRooms.length}.`);
        process.exit(1);
      }
    }
    console.log("All labs fit nicely!");
    
    const theoryNodes = nodes.filter(n => !n.isLab);
    console.log(`Trying to fit ${theoryNodes.length} theory nodes`);
    const availableTheoryRooms = rooms.filter(r => !r.isLab);
    const allSlots = [];
    constraints.workingDays.forEach(day => { for (let p = 1; p <= constraints.periodsPerDay; p++) { allSlots.push({ day, period: p }); } });

    let backtracks = 0;
    const backtrack = (index) => {
      if (index === theoryNodes.length) return true;
      const node = theoryNodes[index];
      for (const slot of allSlots) {
        for (const r of availableTheoryRooms) {
          if (isSlotFree(slot.day, slot.period, node.facultyId, node.batchId, r._id).free) {
            markAllocated(slot.day, slot.period, node.facultyId, node.batchId, r._id, true);
            timetable.push({ day: slot.day, period: slot.period });
            if (backtrack(index + 1)) return true;
            markAllocated(slot.day, slot.period, node.facultyId, node.batchId, r._id, false);
            timetable.pop();
            backtracks++;
            if(backtracks > 1000000) { console.log('Timeout'); process.exit(1); }
          }
        }
      }
      return false;
    };
    
    const success = backtrack(0);
    console.log("Theory success:", success, "Backtracks:", backtracks);

    process.exit(0);
};

testGen();
