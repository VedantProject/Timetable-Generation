import express from "express";
import { loginUser, verifyEmail } from "../controllers/authController.js";

const router = express.Router();

router.post("/login", loginUser);
router.post("/verify-email/:token", verifyEmail);

export default router;
