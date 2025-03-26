// const pageNotFound = async (req,res) => {
//   try {

//   res.render("page.404")

//   } catch (error){
//     res.redirect("/pageNotFound")
//   }
// }

// const loadHomepage = async (req, res) => {
//   try {
//       console.log("Rendering homepage..."); // Debugging log
//       return res.render("home");
//   } catch (error) {
//       console.error("Home page not found", error);
//       res.status(500).send("Server error");
//   }
// };

// module.exports = { loadHomepage , pageNotFound};


const pageNotFound = async (req, res) => {
  try {
    res.render("page-404"); // Fixed incorrect view name
  } catch (error) {
    console.error("Error rendering pageNotFound:", error);
    res.status(500).send("Server error");
  }
};

const loadHomepage = async (req, res) => {
  try {
    console.log("Rendering homepage..."); // Debugging log
    return res.render("home");
  } catch (error) {
    console.error("Error rendering homepage:", error);
    res.status(500).send("Server error");
  }
};

// Ensure functions are correctly exported
module.exports = { loadHomepage, pageNotFound };
