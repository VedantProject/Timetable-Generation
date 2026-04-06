import mongoose from "mongoose";
import dotenv from "dotenv";
import InstitutionalConstraint from "./models/InstitutionalConstraint.js";

dotenv.config();

const check = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const cs = await InstitutionalConstraint.find({ department: 'CSE' }).populate('rooms');
    console.log(`Found ${cs.length} constraints for CSE`);
    cs.forEach(c => {
       console.log(`Constraint ID: ${c._id}, semester: ${c.semester}, labRooms: ${c.rooms.filter(r=>r && r.isLab).length}`);
    });
    process.exit(0);
};

check();
