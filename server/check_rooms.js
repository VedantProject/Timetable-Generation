import mongoose from "mongoose";
import dotenv from "dotenv";
import InstitutionalConstraint from "./models/InstitutionalConstraint.js";
import Room from "./models/Room.js";

dotenv.config();

const check = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const c = await InstitutionalConstraint.findOne({ department: 'CSE' }).populate('rooms');
    if (!c) {
        console.log("No constraints found for CSE");
    } else {
        console.log(`Rooms count: ${c.rooms.length}`);
        console.log(`Lab Rooms count: ${c.rooms.filter(r => r.isLab).length}`);
        console.log(`Theory Rooms count: ${c.rooms.filter(r => !r.isLab).length}`);
    }
    process.exit(0);
};

check();
