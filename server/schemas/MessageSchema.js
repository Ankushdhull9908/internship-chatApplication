import mongoose from "mongoose";
const MessageSchema = new mongoose.Schema({
    conversationId:{
      type:String,
      required:true
    },
    sender:{
      type:String,
      required:true
    },
    receiver:{
      type:String,
      required:true
    },
    
  
    time: { type: Date, default: Date.now },
    
    message:{
      type:String,
      required:true
    }
    
  })

  export default MessageSchema;