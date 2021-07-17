const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const { addUser, removeUser, getUserById, getRoomUsers } = require("./users");
require("dotenv").config();
const { MongoClient } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nlclv.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const port = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({
//   extended: true
// }));

const httpServer = http.createServer(app);
const io = socketIO(httpServer);

app.get("/", (req, res) => res.send("Hello World!"));

client.connect((err) => {
  const userCollection = client.db("onedemic").collection("usersLoginData");

  app.post("/addUser", (req, res) => {
    const name = req.body.name;
    const userName = req.body.userName;
    const email = req.body.email;
    const role = req.body.role;
    userCollection.find({ email: email }).toArray((err, users) => {
      if(users && users.length == 0) {
        userCollection
          .insertOne({ name, userName, email, role })
          .then((result) => {
            console.log(result);
            res.send(result.acknowledged);
          });
      }
    });
  });

  app.post("/getFullUserByEmail", (req, res) => {
    const email = req.body.email;
    userCollection.find({ email: email }).toArray((err, user) => {
      if(user && user.length > 0) {
        res.send(user);
      }
      else{
        console.log('user not found, server side error -getFullUserByEmail', user, email)
      }
    });
  });

  app.post("/isUserNameExist", (req, res) => {
    const userName = req.body.userName;
    userCollection.find({ userName: userName }).toArray((err, user) => {
      if(!err){
        if(user && user.length > 0) {
          console.log(userName)
          // user name exist, so we have to use another username, thats why se.send is false
          res.send(false);
        }
        else{
          console.log(userName,user,'true')
          res.send(true);
        }
      }
    });
  });

  console.log("database connected successfully");
  //   client.close();
});





// chat application part
io.on("connection", (socket) => {
  console.log("a user connected ", socket.id);

  socket.on("join", ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });
    if (error) {
      callback(error);
    }

    socket.join(room);
    socket.emit("message", {
      user: "System",
      text: `welcome ${name} to ${room}.`,
    });

    socket.broadcast.to(room).emit("message", {
      user: "System",
      text: `${name} just joined ${room}.`,
    });

    const roomUsers = getRoomUsers(room);
    io.to(room).emit("userList", { roomUsers });

    callback();
  });

  socket.on("message", (message) => {
    const user = getUserById(socket.id);

    io.to(user.room).emit("message", {
      user: user.name,
      text: message,
    });
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("message", {
        user: "System",
        text: `${user.name} just left ${user.room}.`,
      });

      const roomUsers = getRoomUsers(user.room);
      io.to(user.room).emit("userList", { roomUsers });
    }
  });
});

httpServer.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`)
);
