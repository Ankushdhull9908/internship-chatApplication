import express from "express";
import dotenv, { configDotenv } from "dotenv";
import mongodb from "./Mongodbconection.js";
import cors from 'cors';
import mongoose from "mongoose";
import http from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import userSchema from "./schemas/Userdata.js";
import MessageSchema from "./schemas/MessageSchema.js";
import GroupSchema from "./schemas/GroupSchema.js";
import path from 'path'
import { fileURLToPath } from 'url';
dotenv.config();




// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'uploads', // Cloudinary folder name
    allowed_formats: ['jpg', 'png', 'jpeg'], // Allowed file types
  },
});
const upload = multer({ storage: storage });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Set up CORS
app.use(cors({
  origin: "http://localhost:3000", // Allow your frontend's origin
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

// Middleware for JSON parsing
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// MongoDB connection
mongodb();



// route for uploading profile pic


// Models for User and Message
const User = mongoose.model('User', userSchema);
const Message = mongoose.model("Chats", MessageSchema);
const Group = mongoose.model("Groups", GroupSchema);


// POST endpoint for login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) return res.status(400).json("Invalid credentials");

    res.status(200).json({ message: "Login successful", name: user.name,phone:user.phone,email:user.email,description:user.description,id:user._id });
  } catch (error) {
    console.error(error);
    res.status(500).json("Server error");
  }
});

app.post("/upload-profile/:name", upload.single("profilePic"), async (req, res) => {
  try {
    const username = req.params.name;
    const imageUrl = req.file.path;

    // update user by name instead of id
    const user = await User.findOneAndUpdate(
      { name: username },
      { img: imageUrl },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});


app.get("/groupmessages/:groupId", async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    res.json(group.messages); // messages come from group schema
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/allrooms", async (req, res) => {
  try {
    const group = await Group.find({type:'room'});
    res.json(group); // messages come from group schema
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.post("/addgrpmessage", async (req, res) => {
  try {
    const { groupId, sender, message ,senderimg} = req.body;

    if (!groupId || !sender || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create new message object
    const newMessage = { sender, message,senderimg };

    // Push into messages array
    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      { $push: { messages: newMessage } },
      { new: true } // return updated document
    );

    if (!updatedGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({ success: true, group: updatedGroup });
  } catch (err) {
    console.error("Error adding message:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/groups", async (req, res) => {
  try {
    const { groupName, createdBy, members, groupImage,type } = req.body;

    const group = new Group({
      groupName,
      createdBy,
      members,
      groupImage: groupImage || "",
      type:type
    });

    await group.save();

    res.status(201).json({ success: true, group });
  } catch (err) {
    console.error("Error creating group:", err);
    res.status(500).json({ success: false, error: "Failed to create group" });
  }
});

// Fetch all groups of a user
app.get("/groups/:username", async (req, res) => {
  try {
    const username = req.params.username;

    const groups = await Group.find({
      members: username,
      type:'group'
    });

    res.json({ success: true, groups });
  } catch (err) {
    console.error("Error fetching groups:", err);
    res.status(500).json({ success: false, error: "Failed to fetch groups" });
  }
});


app.post("/confirm-friend", async (req, res) => {
  const { senderId, receiverName } = req.body;

  try {
    // ✅ Step 1: Find the receiver by name
    const receiver = await User.findOne({ name: receiverName });
    if (!receiver) {
      return res.status(404).json({ success: false, message: "Receiver not found" });
    }

    // ✅ Step 2: Find the sender by ID
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ success: false, message: "Sender not found" });
    }

    // ✅ Step 3: Update receiver -> followers
    await User.findByIdAndUpdate(receiver._id, {
      $addToSet: { followers: sender._id }
    });

    // ✅ Step 4: Update sender -> following
    await User.findByIdAndUpdate(sender._id, {
      $addToSet: { following: receiver._id }
    });

    res.json({
      success: true,
      message: `${sender.name} is now following ${receiver.name}`,
      details: {
        follower: sender.name,      // sender becomes follower
        following: receiver.name    // receiver gets followed
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// get followings of a particular user
app.get("/user/:id/followings", async (req, res) => {
  try {
    const { id } = req.params;

    // Find user and populate the following field
    const user = await User.findById(id).populate("following", "name email img");
    

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user.following);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
});




// POST endpoint for user registration (with Cloudinary image upload)
app.post('/register', upload.single('img'), async (req, res) => {
  try {
    const { name, email, password, phone, description } = req.body;
    const imgPath = req.file ? req.file.path : null; // Cloudinary URL

    const userData = { name, email, password, phone, description, img: imgPath };

    const user = await User.create(userData);
    res.status(201).json(user);
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: 'Error saving user' });
  }
});

// POST endpoint for sending a message
app.post('/message', async (req, res) => {
  const { convid,sender, receiver, time, message } = req.body;
  const chatdata = new Message({ conversationId:convid, sender, receiver, time, message });
  await chatdata.save();
  res.status(201).json("Message sent");
});

// GET endpoint to fetch all chats for a conversation
app.get('/allchats/:conversationId', async (req, res) => {
  const { conversationId } = req.params;

  try {
    const result = await Message.find({ conversationId }).sort({ time: 1 });
    res.status(200).json(result); // Send sorted messages as response
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

app.get('/finduser/:username', async (req, res) => {

  const { username } = req.params;
  

  try {
    const result = await User.find({ name:username });
    res.status(200).json(result); // Send sorted messages as response
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});


app.post("/addmembertogroup", async (req, res) => {
  try {
    const { groupId, memberName } = req.body;

    // find group by ID
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // check if already a member
    if (group.members.includes(memberName)) {
      return res.status(400).json({ error: "Already a member" });
    }

    // push new member
    group.members.push(memberName);
    await group.save();

    res.json({ message: "Member added successfully", group });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});


// GET endpoint to fetch all users
app.get('/allusers', async (req, res) => {
  try {
    const result = await User.find();
    res.status(200).json(result); 
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Set up the Socket.IO server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins (use only for debugging)
    methods: ["GET", "POST"],
    credentials: true
  }
});

var users = [];


io.on('connection',(socket)=>{

   

  socket.on('userjoined',(user)=>{
    console.log(user+'joined')

    const filter = users.filter((i)=> i.name===user)

    if(filter.length===0)
    {
         const obj = {name:user,id:socket.id}
         users.push(obj)
         console.log('connected',users)

         
    }else{
      return
    }
  })

  socket.on('useronlineornot',(data)=>{
    const myid = users.filter((i)=> i.name===data.sender)
   
    const filtered = users.filter((i)=> i.name===data.receiver)

    if(filtered.length!==0 && myid.length!==0)
    {
        io.to(myid[0].id).emit('yesonline',data)
       
    }else{
        if(myid.length!==0)
        {
            io.to(myid[0].id).emit('notonline',data)
    }
        }
        

  })

   

  socket.on('sendprivatemsg',(msg)=>{

    var found = users.filter((i)=> i.name===msg.receiver)

    console.log('found',found)

    if(found.length!==0)
    {
      io.to(found[0].id).emit('receivermsg',msg)
     
    }
  })

  socket.on("joinGroup", (groupId) => {
    socket.join(groupId);
    console.log(`${socket.id} joined group ${groupId}`);
  });
  socket.on("sendMessage", (obj) => {
    io.to(obj.groupId).emit("receiveMessage", obj);
  });

  socket.on("joinroom", (obj) => {
    socket.join(obj.roomid);
    console.log(`${obj.name} joined room ${obj.roomid}`);
    io.to(obj.roomid).emit('informothersaboutuser',obj)
  });



  socket.on('sender-typing',(data)=>{
    console.log('typing data',data)

    var found = users.filter((i)=> i.name===data.receiver)

    console.log('found',found)

    if(found.length!==0)
    {
      io.to(found[0].id).emit('receiver-typing',data)
     
    }


  })


 

  socket.on('sendfriendrequest',(data)=>{
    var found = users.filter((i)=> i.name===data.receiver)

    console.log('found',found)

    if(found.length!==0)
    {
      io.to(found[0].id).emit('friendreqfromsender',data)
    }

  })
  
  socket.on('disconnect', () => {
  users = users.filter((user) => user.id !== socket.id);
  console.log('User disconnected. Remaining users:', users);
});


})




// Start the server
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
