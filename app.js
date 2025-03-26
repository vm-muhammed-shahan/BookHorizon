const express = require("express");
const app = express();
require("dotenv").config();
const db = require("./config/db");
const path = require("path")
const userRouter = require("./routes/userRouter");

// Parse the PORT as an integer
const PORT = parseInt(process.env.PORT, 10) || 3000;

db();




app.use(express.json());
app.use(express.urlencoded({extended:true}))

app.set("view engine","ejs");
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,"public")));


app.use("/",userRouter);





// Add error handling for server start
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Server startup error:', err);
});

module.exports = app;