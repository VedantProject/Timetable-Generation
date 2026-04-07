import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { getMyPreferences, submitPreferences, cancelClass, makeupClass, getFacultyConstraints, scheduleExtraClass, deleteExtraClass } from "../controllers/facultyController.js";

const router = express.Router();

router.use(protect);
router.use(authorize("faculty"));

router.route("/preferences")
  .post(submitPreferences);

router.route("/preferences/:semester")
  .get(getMyPreferences);

router.get("/constraints/:semester", getFacultyConstraints);
router.patch("/timetable/entry/:entryId/cancel", cancelClass);
router.delete("/timetable/entry/:entryId/extra-class", deleteExtraClass);
router.post("/timetable/makeup", makeupClass);
router.post("/timetable/extra-class", scheduleExtraClass);

export default router;
