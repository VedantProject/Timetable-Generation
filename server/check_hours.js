import mongoose from "mongoose";
import dotenv from "dotenv";
import Course from "./models/Course.js";

dotenv.config();

const check = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const courses = await Course.find({ department: 'CSE', isLab: true });
    courses.forEach(c => {
       console.log(`${c.courseCode}: labDurationHours = ${c.labDurationHours}, weeklyLabHours = ${c.weeklyLabHours}`);
    });
    process.exit(0);
};

check();
