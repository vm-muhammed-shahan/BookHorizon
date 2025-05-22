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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
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






const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server Running on Port ${PORT} 🗄️`);
});

module.exports = app;