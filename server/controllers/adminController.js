import User from "../models/User.js";
import InstitutionalConstraint from "../models/InstitutionalConstraint.js";
import Room from "../models/Room.js";
import Course from "../models/Course.js";
import FacultyPreference from "../models/FacultyPreference.js";
import bcrypt from "bcryptjs";

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-passwordHash");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create a new user
// @route   POST /api/admin/users
// @access  Private/Admin
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password || "defaultpassword", salt);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      department
    });

    // TODO: Send verification email here using Nodemailer

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update user status / role
// @route   PATCH /api/admin/users/:id
// @access  Private/Admin
export const updateUser = async (req, res) => {
  try {
    const { role, isActive, department } = req.body;
    const user = await User.findById(req.params.id);

    if (user) {
      user.role = role || user.role;
      if (isActive !== undefined) user.isActive = isActive;
      user.department = department || user.department;

      const updatedUser = await user.save();
      res.json(updatedUser);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Deactivate a user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      user.isActive = false;
      await user.save();
      res.json({ message: "User deactivated" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get Institutional Constraints
// @route   GET /api/admin/constraints/:semester
// @access  Private/Admin
export const getConstraints = async (req, res) => {
  try {
    const constraint = await InstitutionalConstraint.findOne({
      semester: req.params.semester,
      // department: req.user.department // Optional, if multi-dept
    }).populate("rooms");
    
    if (constraint) {
      res.json(constraint);
    } else {
      res.status(404).json({ message: "Constraints not found for this semester" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Save/Update Institutional Constraints
// @route   POST /api/admin/constraints
// @access  Private/Admin
export const saveConstraints = async (req, res) => {
  try {
    const { semester, department, workingDays, periodsPerDay, periodDuration, breakPeriods, rooms } = req.body;

    const roomIds = [];
    if (rooms && Array.isArray(rooms)) {
      for (const roomData of rooms) {
        if (roomData._id && !roomData._id.startsWith('temp_')) {
          roomIds.push(roomData._id);
        } else {
          let existingRoom = await Room.findOne({ roomId: roomData.roomId });
          if (existingRoom) {
             existingRoom.capacity = roomData.capacity || existingRoom.capacity;
             existingRoom.isLab = roomData.isLab !== undefined ? roomData.isLab : existingRoom.isLab;
             await existingRoom.save();
             roomIds.push(existingRoom._id);
          } else {
             const newRoom = await Room.create({
               roomId: roomData.roomId,
               capacity: roomData.capacity || 60,
               isLab: roomData.isLab || false,
               building: roomData.building || ""
             });
             roomIds.push(newRoom._id);
          }
        }
      }
    }

    let constraint = await InstitutionalConstraint.findOne({ semester, department });

    if (constraint) {
      constraint.workingDays = workingDays;
      constraint.periodsPerDay = periodsPerDay;
      constraint.periodDuration = periodDuration;
      constraint.breakPeriods = breakPeriods;
      constraint.rooms = roomIds;
      await constraint.save();
    } else {
      constraint = await InstitutionalConstraint.create({
        semester,
        department,
        workingDays,
        periodsPerDay,
        periodDuration,
        breakPeriods,
        rooms: roomIds
      });
    }

    const populatedConstraint = await InstitutionalConstraint.findById(constraint._id).populate("rooms");
    res.json(populatedConstraint);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all courses
// @route   GET /api/admin/courses
// @access  Private/Admin
export const getCourses = async (req, res) => {
  try {
    const courses = await Course.find({}).populate("sections.assignedFacultyId", "name email");
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create course with sections
// @route   POST /api/admin/courses
// @access  Private/Admin
export const createCourse = async (req, res) => {
  try {
    const course = await Course.create(req.body);
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update a course
// @route   PATCH /api/admin/courses/:id
// @access  Private/Admin
export const updateCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (course) {
      res.json(course);
    } else {
      res.status(404).json({ message: "Course not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Bulk Upload Faculty
// @route   POST /api/admin/faculty/bulk-upload
// @access  Private/Admin
export const bulkUploadFaculty = async (req, res) => {
  try {
    const { facultyList } = req.body; // Expects array of objects from parsed CSV {name, email, department}
    if (!facultyList || !Array.isArray(facultyList)) {
      return res.status(400).json({ message: "Invalid data format" });
    }

    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash("faculty123", salt);

    const formedList = facultyList.map(fac => ({
      name: fac.name,
      email: fac.email,
      passwordHash: defaultPasswordHash,
      role: "faculty",
      department: fac.department || "General",
      isActive: true
    }));

    // In a real scenario, skip duplicates or update them. For now, we will use insertMany.
    // Using unordered bulk insert to skip duplicates without throwing entirely
    try {
      await User.insertMany(formedList, { ordered: false });
    } catch (insertError) {
      // 11000 is duplicate key error, we can ignore and say x inserted, y not
      if (insertError.code !== 11000) {
        throw insertError;
      }
    }

    res.json({ message: "Bulk upload completed successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get faculty preferences for a semester
// @route   GET /api/admin/faculty-preferences/:semester
// @access  Private/Admin
export const getFacultyPreferencesForSemester = async (req, res) => {
  try {
    const preferences = await FacultyPreference.find({
      semester: req.params.semester,
    }).select("facultyId unavailableSlots preferredSlots maxWeeklyHours isLocked");

    res.json(preferences);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
