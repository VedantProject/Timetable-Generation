import mongoose from "mongoose";
import dotenv from "dotenv";
import InstitutionalConstraint from "./models/InstitutionalConstraint.js";
import Room from "./models/Room.js";

dotenv.config();

const addRooms = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    
    const semester = "Fall 2024";
    const department = "CSE";
    
    // Create plenty of rooms to ensure success
    const roomDocs = [];
    for (let i=1; i<=10; i++) {
        let r = await Room.findOneAndUpdate(
            { roomId: `T${i}` },
            { roomId: `T${i}`, capacity: 60, isLab: false, building: 'Main' },
            { upsert: true, new: true }
        );
        roomDocs.push(r._id);
        
        let l = await Room.findOneAndUpdate(
            { roomId: `L${i}` },
            { roomId: `L${i}`, capacity: 60, isLab: true, building: 'Labs' },
            { upsert: true, new: true }
        );
        roomDocs.push(l._id);
    }
    
    const constraint = await InstitutionalConstraint.findOne({ semester, department });
    if (constraint) {
        constraint.rooms = roomDocs;
        await constraint.save();
        console.log("Added 10 theory and 10 lab rooms to the constraint successfully!");
    } else {
        console.log("Constraint not found!");
    }

    process.exit(0);
};

addRooms();
