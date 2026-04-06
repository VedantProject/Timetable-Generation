import mongoose from "mongoose";
import dotenv from "dotenv";
import Course from "./models/Course.js";
import InstitutionalConstraint from "./models/InstitutionalConstraint.js";
import Room from "./models/Room.js";

dotenv.config();

const testDb = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const courses = await Course.find();
    console.log("Courses count:", courses.length);
    const deps = [...new Set(courses.map(c => c.department))];
    console.log("Course departments:", deps);

    const constraints = await InstitutionalConstraint.find().populate("rooms");
    console.log("Constraints found:", constraints.length);
    constraints.forEach(c => {
        console.log(`Constraint: ${c.semester} / ${c.department}`);
        console.log("Rooms attached:", c.rooms.length);
        console.log("Lab rooms:", c.rooms.filter(r => r.isLab).length);
    });

    const rooms = await Room.find();
    console.log("Total rooms in DB:", rooms.length);
    process.exit(0);
};

testDb();
