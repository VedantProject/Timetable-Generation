import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";
import Course from "./models/Course.js";

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for seeding!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

const facultyNames = [
  'Prof. K. Francis Sudhakar',
  'Prof. E. Suresh Babu',
  'Prof. S. Ravi Chandra',
  'Prof. R. B. V. Subramaanyam',
  'Prof. Ch. Sudhakar',
  'Prof. Chanchal Suman',
  'Prof. Sujit Das',
  'Prof. Anusha Vangala',
  'Prof. Manjubala Bisi',
  'Prof. K. Sambasiva Rao',
  'Prof. Preeti Soni',
  'Prof. Sangharatna Godboley',
  'Prof. T. Ramakrishnudu',
  'Prof. M. Sandhya'
];

const courseData = [
  {
    courseCode: "MS1262",
    courseName: "Business Essentials for Engineers",
    department: "CSE",
    year: 2,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. K. Francis Sudhakar' },
      { sectionId: 'B', facultyName: 'Prof. K. Sambasiva Rao' }
    ]
  },
  {
    courseCode: "CS1202",
    courseName: "Compiler Design",
    department: "CSE",
    year: 2,
    isLab: true, // Includes LP Lab Component
    weeklyTheoryHours: 3,
    weeklyLabHours: 3,
    labDurationHours: 3,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. E. Suresh Babu' },
      { sectionId: 'B', facultyName: 'Prof. Preeti Soni' }
    ]
  },
  {
    courseCode: "CS1204",
    courseName: "Software Engineering",
    department: "CSE",
    year: 2,
    isLab: true, // Includes SE Lab Component
    weeklyTheoryHours: 3,
    weeklyLabHours: 3,
    labDurationHours: 3,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. S. Ravi Chandra' },
      { sectionId: 'B', facultyName: 'Prof. Sangharatna Godboley' }
    ]
  },
  {
    courseCode: "CS1206",
    courseName: "Database Management Systems",
    department: "CSE",
    year: 2,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. R. B. V. Subramaanyam' },
      { sectionId: 'B', facultyName: 'Prof. T. Ramakrishnudu' }
    ]
  },
  {
    courseCode: "CS1208",
    courseName: "Operating Systems",
    department: "CSE",
    year: 2,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. Ch. Sudhakar' },
      { sectionId: 'B', facultyName: 'Prof. Sujit Das' }
    ]
  },
  {
    courseCode: "CS1210",
    courseName: "Database Systems Laboratory",
    department: "CSE",
    year: 2,
    isLab: true,
    weeklyTheoryHours: 0,
    weeklyLabHours: 3,
    labDurationHours: 3,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. R. B. V. Subramaanyam' },
      { sectionId: 'B', facultyName: 'Prof. T. Ramakrishnudu' }
    ]
  },
  {
    courseCode: "CS1212",
    courseName: "Operating Systems Laboratory",
    department: "CSE",
    year: 2,
    isLab: true,
    weeklyTheoryHours: 0,
    weeklyLabHours: 3,
    labDurationHours: 3,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. Ch. Sudhakar' },
      { sectionId: 'B', facultyName: 'Prof. Sujit Das' }
    ]
  }
];

const seedData = async () => {
  await connectDB();
  
  try {
    // 1. Seed Faculty
    const facultyMap = {};
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("password123", salt);

    for (const name of facultyNames) {
      // Normalize email prefix
      const emailPrefix = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      let user = await User.findOne({ name });
      
      if (!user) {
        user = new User({
          name: name,
          email: `${emailPrefix}@nitw.ac.in`, // default generated email
          passwordHash,
          role: 'faculty',
          department: 'CSE'
        });
        await user.save();
        console.log(`Created new faculty: ${name}`);
      } else {
        console.log(`Faculty ${name} already exists.`);
      }
      facultyMap[name] = user._id;
    }

    // 2. Seed Courses
    for (const data of courseData) {
      let course = await Course.findOne({ courseCode: data.courseCode });
      
      const sections = data.sectionsData.map(sec => ({
        sectionId: sec.sectionId,
        assignedFacultyId: facultyMap[sec.facultyName]
      }));

      if (course) {
        // Update existing
        course.courseName = data.courseName;
        course.department = data.department;
        course.year = data.year;
        course.isLab = data.isLab;
        course.weeklyTheoryHours = data.weeklyTheoryHours;
        course.weeklyLabHours = data.weeklyLabHours;
        course.labDurationHours = data.labDurationHours;
        course.sections = sections;
        await course.save();
        console.log(`Updated course: ${data.courseCode}`);
      } else {
        // Create new
        const newCourse = new Course({
          courseCode: data.courseCode,
          courseName: data.courseName,
          department: data.department,
          year: data.year,
          isLab: data.isLab,
          weeklyTheoryHours: data.weeklyTheoryHours,
          weeklyLabHours: data.weeklyLabHours,
          labDurationHours: data.labDurationHours,
          sections
        });
        await newCourse.save();
        console.log(`Created course: ${data.courseCode}`);
      }
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
};

seedData();
