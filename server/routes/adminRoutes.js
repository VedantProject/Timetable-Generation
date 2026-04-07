import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  getDashboardStats,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getConstraints,
  saveConstraints,
  getCourses,
  createCourse,
  updateCourse,
  bulkUploadFaculty,
  getFacultyPreferencesForSemester
} from "../controllers/adminController.js";
import {
  generateTimetable,
  getGenerationStatus,
  getTimetable,
  publishTimetable,
  moveTimetableEntry,
  exportTimetable
} from "../controllers/timetableController.js";

const router = express.Router();

// All routes require authentication and Admin role
router.use(protect);
router.use(authorize("admin"));

// User Management
router.get("/dashboard/stats", getDashboardStats);

router.route("/users")
  .get(getUsers)
  .post(createUser);

router.route("/users/:id")
  .patch(updateUser)
  .delete(deleteUser);

// Institutional Constraints
router.route("/constraints")
  .post(saveConstraints);
router.route("/constraints/:semester")
  .get(getConstraints);

// Courses & Faculty
router.route("/courses")
  .get(getCourses)
  .post(createCourse);
router.route("/courses/:id")
  .patch(updateCourse);

router.post("/faculty/bulk-upload", bulkUploadFaculty);
router.get("/faculty-preferences/:semester", getFacultyPreferencesForSemester);

// Timetable
router.post("/timetable/generate", generateTimetable);
router.get("/timetable/generate/status/:jobId", getGenerationStatus);
router.route("/timetable/:semester")
  .get(getTimetable);
router.patch("/timetable/:semester/publish", publishTimetable);
router.patch("/timetable/entry/:entryId/move", moveTimetableEntry);
router.get("/timetable/:semester/export", exportTimetable);

export default router;
