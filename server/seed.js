import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Check if an admin already exists
    const adminExists = await User.findOne({ role: "admin" });
    
    if (adminExists) {
      console.log("Admin user already exists. Email:", adminExists.email);
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("admin123", salt);
      
      const admin = await User.create({
        name: "Super Admin",
        email: "admin@atgs.edu",
        passwordHash,
        role: "admin",
        department: "Administration"
      });
      
      console.log("Admin created successfully!");
      console.log("Email: admin@atgs.edu");
      console.log("Password: admin123");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedAdmin();
