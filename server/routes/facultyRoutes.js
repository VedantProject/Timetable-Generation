import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { getMyPreferences, submitPreferences, cancelClass, makeupClass } from "../controllers/facultyController.js";

const router = express.Router();

router.use(protect);
router.use(authorize("faculty"));

router.route("/preferences")
  .post(submitPreferences);

router.route("/preferences/:semester")
  .get(getMyPreferences);

router.patch("/timetable/entry/:entryId/cancel", cancelClass);
router.post("/timetable/makeup", makeupClass);

export default router;
