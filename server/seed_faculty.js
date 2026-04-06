import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const faculties = [
  { name: "Kunja Sambha Shiva Rao", email: "kssrao@nitw.ac.in", department: "Management" }
];

const seedFaculty = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("password123", salt); // Default password

    for (const fac of faculties) {
      const exists = await User.findOne({ email: fac.email });
      if (!exists) {
        await User.create({
          name: fac.name,
          email: fac.email,
          passwordHash,
          role: "faculty",
          department: fac.department
        });
        console.log(`Created faculty: ${fac.name} (${fac.email}, ${fac.department})`);
      } else {
        console.log(`Skipped faculty (already exists): ${fac.name}`);
      }
    }
    
    console.log("Faculty seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding faculty:", error);
    process.exit(1);
  }
};

seedFaculty();
