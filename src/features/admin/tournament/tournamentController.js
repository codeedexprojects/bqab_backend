const Tournament = require("./tournamentModel");
const User = require("../user/userModel");
const Category = require("../category/categoryModel");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const crypto = require("crypto");
const fs = require("fs");

// Points mapping based on position
const POINTS_MAPPING = {
  1: 100,
  2: 75,
  3: 50,
  4: 50,
  5: 25,
  6: 25,
  7: 25,
  8: 25,
  9: 15,
  10: 15,
  11: 15,
  12: 15,
  13: 15,
  14: 15,
  15: 15,
  16: 15,
};

// Position display mapping
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

// Helper function to generate file hash
function generateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

// Helper function to detect category type from name
function detectCategoryType(categoryName) {
  if (!categoryName) return "singles";
  const name = categoryName.toLowerCase().trim();
  const doublesIndicators = [
    "d",
    "doubles",
    "double",
    "gd",
    "bd",
    "xd",
    "md",
    "wd",
  ];

  for (const indicator of doublesIndicators) {
    if (name.includes(indicator)) return "doubles";
  }
  return "singles";
}

// Helper function to generate random unique member ID
function generateRandomMemberId() {
  const randomId = Math.floor(
    10000000000 + Math.random() * 90000000000
  ).toString();
  return `GEN${randomId}`;
}

// Enhanced create tournament with optimized batch processing
exports.createTournamentFromExcel = async (req, res) => {
  let session;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
        errors: [{ message: "Please upload an Excel file" }],
      });
    }

    const { name, location, start_date, end_date } = req.body;

    if (!name) {
      cleanupFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Tournament name is required",
        errors: [{ field: "name", message: "Tournament name is required" }],
      });
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      cleanupFile(req.file);
      return res.status(500).json({
        success: false,
        message: "Database connection not ready",
        errors: [{ message: "Please try again in a moment" }],
      });
    }

    // Check for duplicate file
    const originalFileName = req.file.originalname;
    const fileHash = generateFileHash(req.file.path);

    const [existingByName, existingByHash] = await Promise.all([
      Tournament.findOne({ originalFileName: originalFileName }),
      Tournament.findOne({ fileHash: fileHash }),
    ]);

    if (existingByName) {
      cleanupFile(req.file);
      return res.status(409).json({
        success: false,
        message: "File already exists",
        errors: [
          {
            field: "file",
            message: `A tournament with the file name "${originalFileName}" has already been uploaded.`,
          },
        ],
      });
    }

    if (existingByHash) {
      cleanupFile(req.file);
      return res.status(409).json({
        success: false,
        message: "Duplicate file content",
        errors: [
          {
            field: "file",
            message: "This exact file has already been uploaded previously.",
          },
        ],
      });
    }

    // Start transaction
    session = await mongoose.startSession();
    await session.startTransaction({
      readPreference: "primary",
      readConcern: { level: "local" },
      writeConcern: { w: "majority" },
    });

    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      await session.abortTransaction();
      cleanupFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Excel file has no sheets",
        errors: [{ message: "The uploaded Excel file contains no sheets" }],
      });
    }

    // Pre-load all existing users and categories to reduce DB queries
    const existingUsers = await User.find({}).session(session).lean();
    const userCache = new Map(existingUsers.map((u) => [u.qid, u]));

    const existingCategories = await Category.find({}).session(session).lean();
    const categoryCache = new Map(existingCategories.map((c) => [c.name, c]));

    const allPlayers = [];
    const userPointsMap = new Map();
    const errors = [];
    const createdUsers = [];
    const categoryStats = [];
    const createdCategories = [];
    const generatedMemberIds = new Map();
    const newUsersToCreate = [];
    const newCategoriesToCreate = [];

    // Process all sheets
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        categoryStats.push({
          categoryName: sheetName,
          playersProcessed: 0,
          status: "empty",
        });
        continue;
      }

      const categoryType = detectCategoryType(sheetName);

      // Get or prepare category
      let category = categoryCache.get(sheetName);
      if (!category) {
        category = {
          _id: new mongoose.Types.ObjectId(),
          name: sheetName,
          type: categoryType,
          description: `${sheetName} ${categoryType} category for ${name} tournament`,
        };
        categoryCache.set(sheetName, category);
        newCategoriesToCreate.push(category);
        createdCategories.push({
          _id: category._id,
          name: category.name,
          type: category.type,
        });
      } else if (category.type !== categoryType) {
        // Update category type if needed
        await Category.updateOne(
          { _id: category._id },
          { type: categoryType }
        ).session(session);
        category.type = categoryType;
      }

      let categoryPlayers = 0;
      let categoryErrors = 0;

      // Process all rows in parallel
      const rowPromises = data.map((row, index) =>
        processCategoryRowOptimized(
          row,
          index,
          sheetName,
          category,
          userCache,
          userPointsMap,
          createdUsers,
          errors,
          generatedMemberIds,
          newUsersToCreate
        )
      );

      const results = await Promise.allSettled(rowPromises);

      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          allPlayers.push(result.value);
          categoryPlayers++;
        } else {
          categoryErrors++;
        }
      });

      categoryStats.push({
        categoryName: sheetName,
        categoryType: category.type,
        playersProcessed: categoryPlayers,
        errors: categoryErrors,
        status: categoryPlayers > 0 ? "processed" : "skipped",
      });
    }

    if (allPlayers.length === 0) {
      await session.abortTransaction();
      cleanupFile(req.file);
      return res.status(400).json({
        success: false,
        message: "No valid players found in any category",
        errors: errors,
        categoryStats,
      });
    }

    // Bulk create new categories
    if (newCategoriesToCreate.length > 0) {
      await Category.insertMany(newCategoriesToCreate, { session });
    }

    // Bulk create new users
    if (newUsersToCreate.length > 0) {
      await User.insertMany(newUsersToCreate, { session });
    }

    // Create tournament
    const tournament = new Tournament({
      name,
      location: location || "",
      start_date: start_date || new Date(),
      end_date: end_date || new Date(),
      players: allPlayers,
      categories: [...categoryCache.values()].map((cat) => cat._id),
      status: "completed",
      originalFileName: originalFileName,
      fileHash: fileHash,
    });

    await tournament.save({ session });

    // Bulk update user points
    await bulkUpdateUserPoints(userPointsMap, tournament, session);

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: "Tournament created successfully with categories",
      data: {
        tournament: {
          _id: tournament._id,
          name: tournament.name,
          location: tournament.location,
          start_date: tournament.start_date,
          end_date: tournament.end_date,
          playersCount: allPlayers.length,
          categoriesProcessed: categoryStats.filter(
            (c) => c.playersProcessed > 0
          ).length,
          originalFileName: tournament.originalFileName,
        },
        categories: categoryStats,
        createdCategories:
          createdCategories.length > 0 ? createdCategories : undefined,
        createdUsers: createdUsers.length > 0 ? createdUsers : undefined,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    if (session) {
      await session
        .abortTransaction()
        .catch((e) => console.error("Abort error:", e));
    }

    console.error("Create Tournament Error:", error);

    let userMessage = "Server error";
    if (
      error.name === "MongoNetworkError" ||
      error.message.includes("ECONNRESET")
    ) {
      userMessage = "Database connection issue. Please try again.";
    } else if (error.name === "MongoTimeoutError") {
      userMessage = "Operation timed out. Please try with a smaller file.";
    } else if (error.code === 11000) {
      userMessage = "This file has already been uploaded.";
    }

    res.status(500).json({
      success: false,
      message: userMessage,
      errors: [{ message: error.message }],
    });
  } finally {
    if (session) {
      session.endSession().catch((e) => console.error("Session end error:", e));
    }
    cleanupFile(req.file);
  }
};

// Optimized row processing with cache
async function processCategoryRowOptimized(
  row,
  rowIndex,
  categoryName,
  category,
  userCache,
  userPointsMap,
  createdUsers,
  errors,
  generatedMemberIds,
  newUsersToCreate
) {
  try {
    let memberId = (row["Member ID1"] || "").toString().trim();
    let memberIdTwo = (row["Member ID2"] || "").toString().trim();
    const player1 = (row["Player1"] || "").toString().trim();
    const player2 = (row["Player2"] || "").toString().trim();
    const position = parseInt(row["Position"] || 0);
    const position2 = parseInt(row["Position2"] || position || 0);

    // Generate member ID for player1 if needed
    if (!memberId && player1) {
      memberId = getOrGenerateMemberId(player1, generatedMemberIds, userCache);
      if (!memberId) {
        errors.push({
          category: categoryName,
          row: rowIndex + 2,
          message: `Failed to generate unique member ID for player: ${player1}`,
          data: { player1 },
        });
        return null;
      }
    }

    // Generate member ID for player2 if needed (doubles)
    if (category.type === "doubles" && !memberIdTwo && player2) {
      memberIdTwo = getOrGenerateMemberId(
        player2,
        generatedMemberIds,
        userCache
      );
      if (!memberIdTwo) {
        errors.push({
          category: categoryName,
          row: rowIndex + 2,
          message: `Failed to generate unique member ID for player: ${player2}`,
          data: { player2 },
        });
        return null;
      }
    }

    // Validate required fields
    if (category.type === "singles" && !player1) {
      errors.push({
        category: categoryName,
        row: rowIndex + 2,
        message: "Missing required player name for singles",
        data: { player1 },
      });
      return null;
    }

    if (category.type === "doubles" && (!player1 || !player2)) {
      errors.push({
        category: categoryName,
        row: rowIndex + 2,
        message: "Missing required player names for doubles",
        data: { player1, player2 },
      });
      return null;
    }

    const playersData = {
      category: category._id,
      categoryName: categoryName,
      categoryType: category.type,
      position,
    };

    // Handle Player 1
    if (memberId && player1) {
      const userId = getOrCreateUser(
        memberId,
        player1,
        userCache,
        newUsersToCreate,
        createdUsers,
        categoryName
      );

      const points1 = POINTS_MAPPING[position] || 0;
      updateUserPoints(
        userId,
        memberId,
        player1,
        category,
        points1,
        position,
        userPointsMap
      );

      playersData.memberId = memberId;
      playersData.player1 = player1;
      playersData.user1 = userId;
    }

    // Handle Player 2 (doubles)
    if (memberIdTwo && player2 && category.type === "doubles") {
      const userId = getOrCreateUser(
        memberIdTwo,
        player2,
        userCache,
        newUsersToCreate,
        createdUsers,
        categoryName
      );

      const points2 = POINTS_MAPPING[position2] || 0;
      updateUserPoints(
        userId,
        memberIdTwo,
        player2,
        category,
        points2,
        position2,
        userPointsMap
      );

      playersData.memberIdTwo = memberIdTwo;
      playersData.player2 = player2;
      playersData.user2 = userId;
      playersData.position2 = position2;
    }

    return playersData;
  } catch (error) {
    errors.push({
      category: categoryName,
      row: rowIndex + 2,
      message: `Error processing row: ${error.message}`,
      data: row,
    });
    return null;
  }
}

// Helper to get or generate member ID
function getOrGenerateMemberId(playerName, generatedMemberIds, userCache) {
  const playerKey = playerName.toLowerCase();

  // Check if already generated in this session
  if (generatedMemberIds.has(playerKey)) {
    return generatedMemberIds.get(playerKey);
  }

  // Generate new unique ID
  let attempts = 0;
  let newMemberId;

  while (attempts < 10) {
    newMemberId = generateRandomMemberId();
    // Check against cache
    if (!userCache.has(newMemberId) && !generatedMemberIds.has(newMemberId)) {
      generatedMemberIds.set(playerKey, newMemberId);
      return newMemberId;
    }
    attempts++;
  }

  return null;
}

// Helper to get or create user
function getOrCreateUser(
  memberId,
  playerName,
  userCache,
  newUsersToCreate,
  createdUsers,
  categoryName
) {
  let user = userCache.get(memberId);

  if (!user) {
    const userId = new mongoose.Types.ObjectId();
    user = {
      _id: userId,
      qid: memberId,
      name: playerName,
      points: 0,
      categoryPoints: [],
      pointsHistory: [],
    };

    userCache.set(memberId, user);
    newUsersToCreate.push(user);
    createdUsers.push({
      qid: memberId,
      name: playerName,
      action: "created",
      category: categoryName,
      generatedId: memberId.startsWith("GEN"),
    });
  }

  return user._id;
}

// Helper to update user points map
function updateUserPoints(
  userId,
  memberId,
  playerName,
  category,
  points,
  position,
  userPointsMap
) {
  const userKey = `${userId.toString()}_${category._id.toString()}`;

  if (!userPointsMap.has(userKey)) {
    userPointsMap.set(userKey, {
      userId: userId,
      qid: memberId,
      name: playerName,
      categoryId: category._id,
      categoryName: category.name,
      categoryType: category.type,
      points: 0,
      positions: [],
    });
  }

  const userData = userPointsMap.get(userKey);
  userData.points += points;
  userData.positions.push(position);
}

// Bulk update user points
async function bulkUpdateUserPoints(userPointsMap, tournament, session) {
  const bulkOps = [];

  for (const [userKey, userData] of userPointsMap) {
    // Update total points and category points
    bulkOps.push({
      updateOne: {
        filter: { _id: userData.userId },
        update: {
          $inc: {
            totalPoints: userData.points,
            "categoryPoints.$[elem].points": userData.points,
            "categoryPoints.$[elem].tournamentsCount": 1,
          },
          $set: {
            "categoryPoints.$[elem].lastUpdated": new Date(),
          },
          $push: {
            pointsHistory: {
              tournament: tournament._id,
              tournamentName: tournament.name,
              category: userData.categoryId,
              categoryName: userData.categoryName,
              categoryType: userData.categoryType,
              pointsEarned: userData.points,
              position: Math.min(...userData.positions),
              date: new Date(),
            },
          },
        },
        arrayFilters: [
          {
            "elem.category": userData.categoryId,
          },
        ],
        upsert: false,
      },
    });

    // If category doesn't exist in categoryPoints, add it
    bulkOps.push({
      updateOne: {
        filter: {
          _id: userData.userId,
          "categoryPoints.category": { $ne: userData.categoryId },
        },
        update: {
          $push: {
            categoryPoints: {
              category: userData.categoryId,
              categoryName: userData.categoryName,
              categoryType: userData.categoryType,
              points: userData.points,
              tournamentsCount: 1,
              lastUpdated: new Date(),
            },
          },
        },
      },
    });
  }

  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps, { session, ordered: false });
  }
}

// Helper to cleanup uploaded file
function cleanupFile(file) {
  if (file && file.path) {
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  }
}

// Check file uniqueness endpoint
exports.checkFileUniqueness = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided for validation",
      });
    }

    const originalFileName = req.file.originalname;
    const fileHash = generateFileHash(req.file.path);

    const [existingByName, existingByHash] = await Promise.all([
      Tournament.findOne({ originalFileName }),
      Tournament.findOne({ fileHash }),
    ]);

    const result = {
      success: true,
      data: {
        fileName: originalFileName,
        isFileNameUnique: !existingByName,
        isFileContentUnique: !existingByHash,
        existingTournament:
          existingByName || existingByHash
            ? {
                _id: (existingByName || existingByHash)._id,
                name: (existingByName || existingByHash).name,
                uploadDate: (existingByName || existingByHash).createdAt,
              }
            : null,
      },
    };

    cleanupFile(req.file);
    res.status(200).json(result);
  } catch (error) {
    console.error("File Uniqueness Check Error:", error);
    cleanupFile(req.file);
    res.status(500).json({
      success: false,
      message: "Error checking file uniqueness",
      errors: [{ message: error.message }],
    });
  }
};
// Keep other functions with modifications for category support
exports.getAllTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find()
      .select("-__v -players")
      .populate("categories", "name type")
      .sort({ date: -1 });

    // Add summary information
    const tournamentsWithSummary = tournaments.map((tournament) => ({
      _id: tournament._id,
      name: tournament.name,
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      location: tournament.location,
      status: tournament.status,
      categoriesCount: tournament.categories.length,
      categories: tournament.categories.map((cat) => ({
        _id: cat._id,
        name: cat.name,
        type: cat.type,
      })),
    }));

    res.status(200).json({
      success: true,
      message: "Tournaments retrieved successfully",
      data: tournamentsWithSummary,
      count: tournaments.length,
    });
  } catch (error) {
    console.error("Get All Tournaments Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      errors: [{ message: error.message }],
    });
  }
};

exports.getTournamentById = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournamentId)
      .select("-__v")
      .populate("categories", "name type")
      .populate("players.user1", "name qid points categoryPoints")
      .populate("players.user2", "name qid points categoryPoints")
      .populate(
        "umpires.umpire",
        "name country gender mobileNumber experience umpireId"
      )
      .populate("umpires.categories", "name type");

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: "Tournament not found",
        errors: [{ message: "No tournament found with this ID" }],
      });
    }

    // Group players by category and structure the response
    const categoriesMap = new Map();

    // Initialize categories from tournament categories
    tournament.categories.forEach((cat) => {
      categoriesMap.set(cat._id.toString(), {
        _id: cat._id,
        name: cat.name,
        type: cat.type,
        players: [],
      });
    });

    // Track unique player entries for accurate counting
    const uniquePlayerEntries = new Set();
    const uniqueUsersInTournament = new Set();

    // Group players by category
    tournament.players.forEach((player) => {
      const categoryId = player.category.toString();
      if (categoriesMap.has(categoryId)) {
        const categoryData = categoriesMap.get(categoryId);

        // Calculate points for each player based on position

        const player1Points = POINTS_MAPPING[player.position] || 0;
        const player2Points = POINTS_MAPPING[player.position2] || 0;

        // Get display positions
        const player1DisplayPosition =
          POSITION_DISPLAY_MAPPING[player.position] ||
          player.position.toString();
        const player2DisplayPosition =
          POSITION_DISPLAY_MAPPING[player.position2] ||
          (player.position2 ? player.position2.toString() : "");

        const playerEntry = {
          _id: player._id,
          memberId: player.memberId,
          memberIdTwo: player.memberIdTwo,
          player1: player.player1,
          player2: player.player2,
          position: player.position,
          position2: player.position2,
          displayPosition: player1DisplayPosition,
          displayPosition2: player2DisplayPosition,
          points: player1Points,
          user1: player.user1
            ? {
                _id: player.user1._id,
                name: player.user1.name,
                qid: player.user1.qid,
                totalPoints: player.user1.points,
                categoryPoints:
                  player.user1.categoryPoints.find(
                    (cp) => cp.category && cp.category.toString() === categoryId
                  )?.points || 0,
              }
            : null,
          user2: player.user2
            ? {
                _id: player.user2._id,
                name: player.user2.name,
                qid: player.user2.qid,
                totalPoints: player.user2.points,
                categoryPoints:
                  player.user2.categoryPoints.find(
                    (cp) => cp.category && cp.category.toString() === categoryId
                  )?.points || 0,
              }
            : null,
        };

        categoryData.players.push(playerEntry);

        // Count this as one player entry (team in doubles, individual in singles)
        uniquePlayerEntries.add(player._id.toString());

        // Track unique users across the tournament
        if (player.user1) {
          uniqueUsersInTournament.add(player.user1._id.toString());
        }
        if (player.user2) {
          uniqueUsersInTournament.add(player.user2._id.toString());
        }
      }
    });

    // Convert map to array and sort players by position
    const categories = Array.from(categoriesMap.values()).map((category) => ({
      ...category,
      players: category.players.sort((a, b) => a.position - b.position),
    }));

    // Process umpires data - simplified without role validation
    const umpires = tournament.umpires.map((umpireAssignment) => ({
      _id: umpireAssignment.umpire._id,
      umpireId: umpireAssignment.umpire.umpireId,
      name: umpireAssignment.umpire.name,
      country: umpireAssignment.umpire.country,
      passport: umpireAssignment.umpire.passport,
      gender: umpireAssignment.umpire.gender,
      mobileNumber: umpireAssignment.umpire.mobileNumber,
      experience: umpireAssignment.umpire.experience,
      role: umpireAssignment.role,
      assignedCategories: umpireAssignment.categories,
      assignedDate: umpireAssignment.assignedDate,
    }));

    // Group umpires by role dynamically (no preset roles)
    const umpiresByRole = {};
    umpires.forEach((umpire) => {
      const role = umpire.role || "chair_umpire";
      if (!umpiresByRole[role]) {
        umpiresByRole[role] = [];
      }
      umpiresByRole[role].push(umpire);
    });

    // Calculate accurate statistics
    const singlesCategories = categories.filter(
      (cat) => cat.type === "singles"
    );
    const doublesCategories = categories.filter(
      (cat) => cat.type === "doubles"
    );

    const singlesEntries = singlesCategories.reduce(
      (total, cat) => total + cat.players.length,
      0
    );
    const doublesEntries = doublesCategories.reduce(
      (total, cat) => total + cat.players.length,
      0
    );
    const totalTeams = singlesEntries + doublesEntries;
    const totalIndividualPlayers = singlesEntries + doublesEntries * 2;

    // Structure the final response
    const structuredTournament = {
      _id: tournament._id,
      name: tournament.name,
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      location: tournament.location,
      status: tournament.status,
      isActive: tournament.isActive,
      originalFileName: tournament.originalFileName,
      categories: categories,
      umpires: {
        all: umpires,
        byRole: umpiresByRole,
        statistics: {
          totalUmpires: umpires.length,
          roles: Object.keys(umpiresByRole).map((role) => ({
            role: role,
            count: umpiresByRole[role].length,
          })),
        },
      },
      statistics: {
        totalCategories: categories.length,
        singlesCategories: singlesCategories.length,
        doublesCategories: doublesCategories.length,
        totalPlayerEntries: uniquePlayerEntries.size,
        totalTeams: totalTeams,
        totalIndividualPlayers: totalIndividualPlayers,
        uniqueUsers: uniqueUsersInTournament.size,
        umpiresCount: umpires.length,
      },
      timestamps: {
        createdAt: tournament.createdAt,
        updatedAt: tournament.updatedAt,
      },
    };

    res.status(200).json({
      success: true,
      message: "Tournament retrieved successfully",
      data: structuredTournament,
    });
  } catch (error) {
    console.error("Get Tournament Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      errors: [{ message: error.message }],
    });
  }
};

// Add this to your tournamentController.js
exports.getTournamentWithRankings = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournamentId)
      .populate("categories", "name type")
      .populate("players.user1", "name qid categoryPoints")
      .populate("players.user2", "name qid categoryPoints");

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: "Tournament not found",
        errors: [{ message: "No tournament found with this ID" }],
      });
    }

    // Group by category and calculate rankings
    const categoriesWithRankings = [];
    const categoryMap = new Map();

    tournament.players.forEach((player) => {
      const categoryId = player.category.toString();
      if (!categoryMap.has(categoryId)) {
        const category = tournament.categories.find(
          (c) => c._id.toString() === categoryId
        );
        categoryMap.set(categoryId, {
          category: category,
          players: [],
        });
      }

      const categoryData = categoryMap.get(categoryId);
      const points = POINTS_MAPPING[player.position] || 0;

      if (player.categoryType === "singles" && player.user1) {
        categoryData.players.push({
          user: player.user1,
          memberId: player.memberId,
          position: player.position,
          points: points,
        });
      } else if (player.categoryType === "doubles") {
        // Handle doubles - both players get the same points
        if (player.user1) {
          categoryData.players.push({
            user: player.user1,
            memberId: player.memberId,
            position: player.position,
            points: points,
            partner: player.user2,
          });
        }
        if (player.user2) {
          categoryData.players.push({
            user: player.user2,
            memberId: player.memberIdTwo,
            position: player.position2,
            points: points,
            partner: player.user1,
          });
        }
      }
    });

    // Sort and rank players in each category
    categoryMap.forEach((categoryData) => {
      categoryData.players.sort((a, b) => b.points - a.points);

      const playersWithRank = categoryData.players.map((player, index) => ({
        rank: index + 1,
        ...player,
      }));

      categoriesWithRankings.push({
        category: categoryData.category,
        players: playersWithRank,
      });
    });

    res.status(200).json({
      success: true,
      message: "Tournament with rankings retrieved successfully",
      data: {
        tournament: {
          _id: tournament._id,
          name: tournament.name,
          date: tournament.date,
          location: tournament.location,
        },
        categories: categoriesWithRankings,
      },
    });
  } catch (error) {
    console.error("Get Tournament With Rankings Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      errors: [{ message: error.message }],
    });
  }
};
exports.deleteTournament = async (req, res) => {
  let session;

  try {
    session = await mongoose.startSession();
    const transactionOptions = {
      readPreference: "primary",
      readConcern: { level: "local" },
      writeConcern: { w: "majority" },
      maxTimeMS: 30000,
    };

    await session.startTransaction(transactionOptions);

    const tournament = await Tournament.findById(req.params.tournamentId)
      .populate("categories")
      .session(session);

    if (!tournament) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Tournament not found",
        errors: [{ message: "No tournament found with this ID" }],
      });
    }

    // Revert user points by category
    const userIds = new Set();
    const categoryIds = tournament.categories.map((cat) => cat._id.toString());

    tournament.players.forEach((player) => {
      if (player.user1) userIds.add(player.user1.toString());
      if (player.user2) userIds.add(player.user2.toString());
    });

    const revertPromises = Array.from(userIds).map((userId) =>
      revertUserCategoryPoints(userId, tournament._id, categoryIds, session)
    );

    await Promise.allSettled(revertPromises);
    await Tournament.findByIdAndDelete(req.params.tournamentId).session(
      session
    );
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Tournament deleted and points reverted successfully",
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Error aborting transaction:", abortError);
      }
    }

    console.error("Delete Tournament Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      errors: [{ message: error.message }],
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

async function revertUserCategoryPoints(
  userId,
  tournamentId,
  categoryIds,
  session
) {
  try {
    const user = await User.findById(userId).session(session);
    if (user) {
      // Find history entries for this tournament
      const historyEntries = user.pointsHistory.filter(
        (h) => h.tournament.toString() === tournamentId.toString()
      );

      // Revert points for each category
      historyEntries.forEach((entry) => {
        if (entry.category) {
          const currentPoints =
            user.categoryPoints.get(entry.category.toString()) || 0;
          const newPoints = Math.max(0, currentPoints - entry.pointsEarned);
          user.categoryPoints.set(entry.category.toString(), newPoints);
        }

        // Revert total points
        user.points = Math.max(0, (user.points || 0) - entry.pointsEarned);
      });

      // Remove history entries for this tournament
      user.pointsHistory = user.pointsHistory.filter(
        (h) => h.tournament.toString() !== tournamentId.toString()
      );

      await user.save({ session });
    }
  } catch (error) {
    console.error(`Error reverting points for user ${userId}:`, error);
    throw error;
  }
}
