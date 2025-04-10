// const express = require("express");
// const app = express();
// const path = require("path");
// const env = require("dotenv").config();
// const session = require("express-session");
// const passport = require("./config/passport");
// const db = require("./config/db");
// const userRouter = require("./routes/userRouter");
// const adminRouter = require("./routes/adminRouter");
// db();

// app.use(express.json());
// app.use(express.urlencoded({ extended: true}));
// app.use(session({
//   secret:process.env.SESSION_SECRET,
//   resave:false,
//   saveUninitialized:true,
//   cookie:{
//     secure:false,
//     httpOnly:true,
//     maxAge:72*60*60*1000
//   }
// }))

// app.use(passport.initialize());
// app.use(passport.session());



// app.use((req,res,next)=>{
//   res.set("cache-control", 'no-store')
//   next();
// });



// app.set("view engine","ejs");
// app.set("views", [path.join(__dirname, "views/user"),path.join(__dirname,'views/admin')]);

// const publicPath = path.join(__dirname, "public");
// console.log("Static folder path:", publicPath); 
// app.use(express.static(publicPath));

// app.use((req, res, next) => {
//   // console.log("Session User:", req.session.user); // Debug log
//   next();
// });


// app.use("/", userRouter);
// app.use("/admin",adminRouter);



//   const PORT = process.env.PORT || 4000;
// app.listen(PORT, () => {
//   console.log(`Server Running on Port ${PORT}`);
// });

// // console.log("NODEMAILER_EMAIL:", process.env.NODEMAILER_EMAIL);
// // console.log("NODEMAILER_PASSWORD:", process.env.NODEMAILER_PASSWORD);


// module.exports = app;





















// const express = require("express");
// const app = express();
// const path = require("path");
// const env = require("dotenv").config();
// const session = require("express-session");
// const passport = require("./config/passport");
// const db = require("./config/db");
// const userRouter = require("./routes/userRouter");
// const adminRouter = require("./routes/adminRouter");
// db();

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: true,
//   cookie: {
//     secure: false,
//     httpOnly: true,
//     maxAge: 72 * 60 * 60 * 1000
//   }
// }));

// app.use(passport.initialize());
// app.use(passport.session());

// app.use((req, res, next) => {
//   res.set("cache-control", "no-store");
//   next();
// });

// app.set("view engine", "ejs");
// app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);

// // Serve static files from public folder
// const publicPath = path.join(__dirname, "public");
// console.log("Static folder path:", publicPath);
// app.use(express.static(publicPath));

// // Serve node_modules for libraries like cropperjs
// app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));

// app.use((req, res, next) => {
//   // console.log("Session User:", req.session.user); // Debug log
//   next();
// });

// app.use("/", userRouter);
// app.use("/admin", adminRouter);

// const PORT = process.env.PORT || 4000;
// app.listen(PORT, () => {
//   console.log(`Server Running on Port ${PORT}`);
// });

// // console.log("NODEMAILER_EMAIL:", process.env.NODEMAILER_EMAIL);
// // console.log("NODEMAILER_PASSWORD:", process.env.NODEMAILER_PASSWORD);

// module.exports = app;












const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const multer = require('multer'); 
db();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 72 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/'); // Save files in public/uploads
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // Unique filename
  }
});
const upload = multer({ storage: storage });

app.use((req, res, next) => {
  res.set("cache-control", "no-store");
  next();
});

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);


const publicPath = path.join(__dirname, "public");
console.log("Static folder path:", publicPath);
app.use(express.static(publicPath));


app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));

app.use((req, res, next) => {
  
  next();
});


app.use(upload.array('images', 4)); // Handle up to 4 images

app.use("/", userRouter);
app.use("/admin", adminRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server Running on Port ${PORT}`);
});

module.exports = app;