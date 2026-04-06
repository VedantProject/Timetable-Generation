import mongoose from "mongoose";
import dotenv from "dotenv";
import InstitutionalConstraint from "./models/InstitutionalConstraint.js";

dotenv.config();

const fixDb = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find all 'Computer Science' constraints
    const constraints = await InstitutionalConstraint.find({ department: 'Computer Science' });
    
    for (let c of constraints) {
        c.department = 'CSE';
        try {
            await c.save();
            console.log(`Updated constraint for ${c.semester} to CSE`);
        } catch (e) {
            // Might clash if 'CSE' already exists, if so delete 'Computer Science'
            console.log('Error saving, maybe CSE already exists', e.message);
        }
    }
    
    process.exit(0);
};

fixDb();
