import mongoose from "mongoose";
import dotenv from "dotenv";
import InstitutionalConstraint from "./models/InstitutionalConstraint.js";

dotenv.config();

const check = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const c = await InstitutionalConstraint.findOne({ department: 'CSE' });
    console.log("Periods: ", c.periodsPerDay);
    console.log("Breaks: ", c.breakPeriods);
    process.exit(0);
};

check();
