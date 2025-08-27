import mongoose from "mongoose";


const MessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  time: {
    type: Date,
    default: Date.now
  },
  senderimg:{
    type: String,
    required: true
  }
});

const GroupSchema = new mongoose.Schema({
  groupName: {
    type: String,
    required: true
  },
  type:{
    type:String,
    required:true
  },

  groupImage: {
    type: String, // optional - for group photo URL
    default: ""
  },

  createdBy: {
    type: String, // user ID or name of admin
    required: true
  },

  members: [
    {
      type: String, // user ID or username
      required: true
    }
  ],


  messages: [MessageSchema], // array of message objects

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default GroupSchema;