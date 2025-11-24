const Tournament = require("../tournament/tournamentModel");
const Club = require("../club/clubModel");
const Umpire = require("../umpire/umpireModel");
const User = require("../user/userModel");

// Get dashboard counts
exports.getDashboardCounts = async (req, res) => {
  try {
    // Get all counts in parallel for better performance
    const [tournamentCount, clubCount, umpireCount, userCount] = await Promise.all([
      Tournament.countDocuments(),
      Club.countDocuments(),
      Umpire.countDocuments(),
      User.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      message: "Dashboard counts retrieved successfully",
      data: {
        tournamentCount,
        clubCount, 
        umpireCount,
        userCount
      }
    });

  } catch (error) {
    console.error("Get Dashboard Counts Error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving dashboard counts",
      error: error.message
    });
  }
};