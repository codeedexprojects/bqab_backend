const User = require("./userModel");
const mongoose = require("mongoose");
const Tournament = require("../tournament/tournamentModel");

const POSITION_DISPLAY_MAPPING = {
  1: "Winner",
  2: "Runner-Up",
  3: "Semifinal",
  4: "Semifinal",
  5: "Quarter Final",
  6: "Quarter Final",
  7: "Quarter Final",
  8: "Quarter Final",
  9: "Pre-Quarter",
  10: "Pre-Quarter",
  11: "Pre-Quarter",
  12: "Pre-Quarter",
  13: "Pre-Quarter",
  14: "Pre-Quarter",
  15: "Pre-Quarter",
  16: "Pre-Quarter",
};

const getDisplayPosition = (position) => {
  return (
    POSITION_DISPLAY_MAPPING[position] || (position ? position.toString() : "")
  );
};

exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      qid,
      club,
      country,
      dob,
      gender,
      mobile,
      level,
      passport,
      role = "customer",
      isActive = "true",
    } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: [{ field: "email", message: "Email is required" }],
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: [
          { field: "email", message: "Please provide a valid email address" },
        ],
      });
    }

    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: [{ field: "email", message: "Email already exists" }],
      });
    }

    if (mobile) {
      const existingUser = await User.findOne({ mobile });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: [
            { field: "mobile", message: "Mobile number already exists" },
          ],
        });
      }
    }

    const isActiveBool = isActive === "true";

    const imageUrl = req.body.image || "";

    const newUser = new User({
      name: name || "",
      email: email,
      image: imageUrl,
      qid: qid || "",
      club: club || null,
      country: country || "",
      passport: passport || "",
      dob: dob ? new Date(dob) : null,
      gender: gender || "",
      mobile: mobile || "",
      level: level || "",
      role: role || "customer",
      isActive: isActiveBool,
    });

    await newUser.save();

    const createdUser = await User.findById(newUser._id)
      .select("-__v")
      .populate("club", "name");

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: createdUser,
    });
  } catch (error) {
    console.error("Create User Error:", error);
    console.error("Error Stack:", error.stack);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: [{ field, message: `${field} already exists` }],
      });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.updateUserById = async (req, res) => {
  const {
    name,
    email,
    qid,
    club,
    country,
    dob,
    passport,
    gender,
    mobile,
    level,
    role,
    isActive,
  } = req.body;

  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        errors: [{ message: "No user found with this ID" }],
      });
    }

    if (email && email !== user.email) {
      const existingEmailUser = await User.findOne({
        email,
        _id: { $ne: user._id },
      });
      if (existingEmailUser) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: [{ field: "email", message: "Email already exists" }],
        });
      }
    }

    if (mobile && mobile !== user.mobile) {
      const existingUser = await User.findOne({
        mobile,
        _id: { $ne: user._id },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: [
            { field: "mobile", message: "Mobile number already exists" },
          ],
        });
      }
    }

    let imageUpdate = undefined;
    if (req.file) {
      imageUpdate = req.file.path;
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (imageUpdate !== undefined) user.image = imageUpdate;
    if (qid !== undefined) user.qid = qid;
    if (club !== undefined) user.club = club;
    if (passport !== undefined) user.passport = passport;
    if (country !== undefined) user.country = country;
    if (dob !== undefined) user.dob = dob;
    if (gender !== undefined) user.gender = gender;
    if (mobile !== undefined) user.mobile = mobile;
    if (level !== undefined) user.level = level;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-__v")
      .populate("club", "name");

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update User Error:", error.message);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: [{ field, message: `${field} already exists` }],
      });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      errors: [{ message: error.message }],
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-__v")
      .populate("club", "name")
      .sort({ si_no: 1 });
    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users,
      count: users.length,
    });
  } catch (error) {
    console.error("Get All Users Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
      errors: [{ message: error.message }],
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("-__v")
      .populate("club", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        errors: [{ message: "No user found with this ID" }],
      });
    }

    const userTournaments = await Tournament.find({
      $or: [{ "players.user1": user._id }, { "players.user2": user._id }],
    })
      .populate("categories", "name type")
      .select("name start_date end_date location status players categories")
      .sort({ end_date: -1 });

    const categoryMap = new Map();

    userTournaments.forEach((tournament) => {
      const userEntries = tournament.players.filter(
        (player) =>
          player.user1?.toString() === user._id.toString() ||
          player.user2?.toString() === user._id.toString()
      );

      userEntries.forEach((entry) => {
        const categoryId = entry.category?.toString();

        if (!categoryId) return;

        if (!categoryMap.has(categoryId)) {
          const categoryDetails = tournament.categories.find(
            (cat) => cat._id.toString() === categoryId
          ) || {
            _id: entry.category,
            name: entry.categoryName || "Unknown Category",
            type: entry.categoryType || "singles",
          };

          categoryMap.set(categoryId, {
            category: {
              _id: categoryDetails._id,
              name: categoryDetails.name,
              type: categoryDetails.type,
            },
            totalPoints: 0,
            tournaments: [],
          });
        }

        const categoryData = categoryMap.get(categoryId);

        const pointsEarned =
          user.pointsHistory.find(
            (ph) =>
              ph.tournament?.toString() === tournament._id.toString() &&
              ph.category?.toString() === categoryId
          )?.pointsEarned || 0;

        categoryData.totalPoints += pointsEarned;

        const tournamentEntry = {
          tournament: {
            _id: tournament._id,
            name: tournament.name,
            start_date: tournament.start_date,
            end_date: tournament.end_date,
            location: tournament.location,
            status: tournament.status,
          },
          participation: {
            position: entry.position,
            position2: entry.position2,
            displayPosition: getDisplayPosition(entry.position),
            displayPosition2: getDisplayPosition(entry.position2),
            memberId:
              entry.user1?.toString() === user._id.toString()
                ? entry.memberId
                : entry.memberIdTwo,
            pointsEarned: pointsEarned,
            partner:
              entry.categoryType === "doubles"
                ? {
                    userId:
                      entry.user1?.toString() === user._id.toString()
                        ? entry.user2
                        : entry.user1,
                    name:
                      entry.user1?.toString() === user._id.toString()
                        ? entry.player2
                        : entry.player1,
                    memberId:
                      entry.user1?.toString() === user._id.toString()
                        ? entry.memberIdTwo
                        : entry.memberId,
                  }
                : null,
          },
        };

        categoryData.tournaments.push(tournamentEntry);
      });
    });

    const categoriesWithTournaments = Array.from(categoryMap.values()).map(
      (categoryData) => ({
        ...categoryData,
        tournaments: categoryData.tournaments.sort(
          (a, b) => new Date(b.tournament.date) - new Date(a.tournament.date)
        ),
      })
    );

    const totalTournaments = new Set();
    userTournaments.forEach((tournament) => {
      totalTournaments.add(tournament._id.toString());
    });

    const response = {
      user: {
        _id: user._id,
        si_no: user.si_no,
        name: user.name,
        image: user.image, 
        qid: user.qid,
        club: user.club,
        country: user.country,
        dob: user.dob,
        gender: user.gender,
        mobile: user.mobile,
        level: user.level,
        passport: user.passport,
        role: user.role,
        isActive: user.isActive,
        totalPoints: user.points,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },

      categoryParticipation: categoriesWithTournaments,

      summary: {
        totalTournaments: totalTournaments.size,
        totalCategories: categoriesWithTournaments.length,
        totalPoints: user.points,
        pointsByCategory: user.categoryPoints.map((cp) => ({
          categoryId: cp.category,
          points: cp.points,
        })),
      },
    };

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: response,
    });
  } catch (error) {
    console.error("Get User By ID Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
      errors: [{ message: error.message }],
    });
  }
};

exports.deleteUserById = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        errors: [{ message: "No user found with this ID" }],
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
      errors: [{ message: error.message }],
    });
  }
};
