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
    console.log("MongoDB connected for seeding 3rd year!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

const facultyNames = [
  'Prof. Shiva Darshan SL',
  'Prof. R. Padmavathy',
  'Prof. Ramalingaswamy Cheruku',
  'Prof. Manish Kumar Bajpai',
  'Prof. Sriram Kailasam',
  'Prof. Ch. Sudhakar',
  'Prof. P. Venkata Subba Reddy',
  'Prof. Manoj Kumar Patra',
  'Prof. Anusha Vangala',
  'Prof. Venkateswara Rao Kagita',
  'Prof. Venkatarami Reddy C.',
  'Prof. Sarath Babu',
  'Prof. U. S. N. Raju'
];

const courseData = [
  {
    courseCode: "CS351",
    courseName: "Mobile Computing",
    department: "CSE",
    year: 3,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. Shiva Darshan SL' },
      { sectionId: 'B', facultyName: 'Prof. Venkatarami Reddy C.' }
    ]
  },
  {
    courseCode: "CS352",
    courseName: "Cryptography",
    department: "CSE",
    year: 3,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. R. Padmavathy' },
      { sectionId: 'B', facultyName: 'Prof. Sarath Babu' }
    ]
  },
  {
    courseCode: "CS353",
    courseName: "Machine Learning",
    department: "CSE",
    year: 3,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. Ramalingaswamy Cheruku' },
      { sectionId: 'B', facultyName: 'Prof. Venkateswara Rao Kagita' }
    ]
  },
  {
    courseCode: "CS354",
    courseName: "Advanced Algorithms",
    department: "CSE",
    year: 3,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. Manish Kumar Bajpai' },
      { sectionId: 'B', facultyName: 'Prof. Manish Kumar Bajpai' }
    ]
  },
  {
    courseCode: "CS362",
    courseName: "Distributed Computing",
    department: "CSE",
    year: 3,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. Sriram Kailasam' },
      { sectionId: 'B', facultyName: 'Prof. Sriram Kailasam' }
    ]
  },
  {
    courseCode: "CS378",
    courseName: "High Performance Computing",
    department: "CSE",
    year: 3,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. Ch. Sudhakar' },
      { sectionId: 'B', facultyName: 'Prof. Ch. Sudhakar' }
    ]
  },
  {
    courseCode: "CS366",
    courseName: "Quantum Computing",
    department: "CSE",
    year: 3,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. P. Venkata Subba Reddy' },
      { sectionId: 'B', facultyName: 'Prof. U. S. N. Raju' }
    ]
  },
  {
    courseCode: "CS374",
    courseName: "Cloud Computing",
    department: "CSE",
    year: 3,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. Manoj Kumar Patra' },
      { sectionId: 'B', facultyName: 'Prof. Manoj Kumar Patra' }
    ]
  },
  {
    courseCode: "CS355",
    courseName: "Cryptography Laboratory",
    department: "CSE",
    year: 3,
    isLab: true,
    weeklyTheoryHours: 0,
    weeklyLabHours: 3,
    labDurationHours: 3,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. R. Padmavathy' },
      { sectionId: 'B', facultyName: 'Prof. Sarath Babu' }
    ]
  },
  {
    courseCode: "CS356",
    courseName: "Machine Learning Laboratory",
    department: "CSE",
    year: 3,
    isLab: true,
    weeklyTheoryHours: 0,
    weeklyLabHours: 3,
    labDurationHours: 3,
    sectionsData: [
      { sectionId: 'A', facultyName: 'Prof. Ramalingaswamy Cheruku' },
      { sectionId: 'B', facultyName: 'Prof. Venkateswara Rao Kagita' }
    ]
  },
  {
    courseCode: "OE300", // placeholder code since it's missing in image
    courseName: "Open Elective",
    department: "CSE",
    year: 3,
    isLab: false,
    weeklyTheoryHours: 3,
    weeklyLabHours: 0,
    labDurationHours: 0,
    sectionsData: [
      { sectionId: 'A', facultyName: null },
      { sectionId: 'B', facultyName: null }
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
      if (!name) continue;
      // Normalize email prefix
      const emailPrefix = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      let user = await User.findOne({ name });
      
      if (!user) {
        user = new User({
          name: name,
          email: `${emailPrefix}_3rd@nitw.ac.in`, // default generated email, added _3rd to avoid very rare collision if names subset
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
        assignedFacultyId: sec.facultyName ? facultyMap[sec.facultyName] : undefined
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

    console.log("Seeding 3rd year completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
};

seedData();
