import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getVisibleTimetable } from "../controllers/timetableController.js";

const router = express.Router();

router.use(protect);

router.get("/:semester", getVisibleTimetable);

export default router;
