const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
db();


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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


app.use((req, res, next) => {
  res.set("cache-control", "no-store");
  next();
});

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);


const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));


app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));


app.use("/", userRouter);
app.use("/admin", adminRouter);





app.use((req, res, next) => {
  res.status(404);
  return res.render("error", { message: "Page not found" });
});


app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(err.status || 500);

  if (req.xhr || req.headers.accept.indexOf("json") > -1) {
    return res.json({ success: false, error: err.message || "Server error" });
  }

  res.render("error", { message: err.message || "Something went wrong" });
});



const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Server Running on Port ${PORT} 🗄️`);
});


server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Kill the process or use a different port.`);
    process.exit(1);
  } else {
    throw err;
  }
});


module.exports = app;