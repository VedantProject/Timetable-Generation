import mongoose from "mongoose";
import dotenv from "dotenv";
import FacultyPreference from "./models/FacultyPreference.js";

dotenv.config();

const check = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const prefs = await FacultyPreference.find();
    console.log("Faculty Prefs count:", prefs.length);
    prefs.forEach(p => {
        console.log(`Fac: ${p.facultyId}, unavailable: ${JSON.stringify(p.unavailableSlots)}`);
    });
    process.exit(0);
};

check();
