import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  capacity: {
    type: Number,
    required: true,
  },
  isLab: {
    type: Boolean,
    default: false,
  },
  building: {
    type: String,
    required: false,
    trim: true,
  },
});

const Room = mongoose.model("Room", roomSchema);

export default Room;
