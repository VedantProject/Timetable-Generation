// check_courses.mjs — node check_courses.mjs
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const sectionSchema = new mongoose.Schema({
  sectionId: String,
  assignedFacultyId: mongoose.Schema.Types.ObjectId,
});
const courseSchema = new mongoose.Schema({
  courseCode: String, courseName: String, department: String, year: Number,
  isLab: Boolean, labDurationHours: Number, weeklyTheoryHours: Number,
  sections: [sectionSchema],
}, { timestamps: true });

const Course = mongoose.model("Course", courseSchema);

await mongoose.connect(MONGODB_URI);
console.log("Connected");

const courses = await Course.find({ department: "CSE" }).lean();
console.log(`\nTotal courses: ${courses.length}`);

let missingFaculty = 0;
courses.forEach(c => {
  c.sections.forEach(s => {
    if (!s.assignedFacultyId) {
      missingFaculty++;
      console.warn(`  ⚠️  ${c.courseCode} [${c.courseName}] Year ${c.year} Section "${s.sectionId}" — NO FACULTY`);
    }
  });
});

if (missingFaculty === 0) {
  console.log("\n✅ All sections have faculty assigned");
} else {
  console.log(`\n❌ ${missingFaculty} section(s) missing faculty — assign faculty in the Courses page first!`);
}

mongoose.disconnect();
