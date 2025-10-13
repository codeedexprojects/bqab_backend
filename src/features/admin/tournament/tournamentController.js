const Tournament = require('./tournamentModel');
const User = require('../user/userModel');
const Category = require('../category/categoryModel');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

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
  16: 15
};

// Helper function to detect category type from name
function detectCategoryType(categoryName) {
  if (!categoryName) return 'singles';
  
  const name = categoryName.toLowerCase().trim();
  
  const doublesIndicators = ['d', 'doubles', 'double', 'gd', 'bd', 'xd', 'md', 'wd'];
  const singlesIndicators = ['s', 'singles', 'single', 'gs', 'bs', 'xs', 'ms', 'ws'];
  
  for (const indicator of doublesIndicators) {
    if (name.includes(indicator)) {
      return 'doubles';
    }
  }
  
  for (const indicator of singlesIndicators) {
    if (name.includes(indicator)) {
      return 'singles';
    }
  }
  
  return 'singles';
}

// Helper function to generate random unique member ID
function generateRandomMemberId() {
  // Generate 11-digit random number (like 28635616918)
  const randomId = Math.floor(10000000000 + Math.random() * 90000000000).toString();
  return `GEN${randomId}`; // Prefix with GEN to identify generated IDs
}

// Enhanced create tournament with category support
exports.createTournamentFromExcel = async (req, res) => {
  let session;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        errors: [{ message: 'Please upload an Excel file' }]
      });
    }

    const { name, location, date } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tournament name is required',
        errors: [{ field: 'name', message: 'Tournament name is required' }]
      });
    }

    // Check MongoDB connection first
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not ready',
        errors: [{ message: 'Please try again in a moment' }]
      });
    }

    // Start session with longer timeout
    session = await mongoose.startSession();
    const transactionOptions = {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' },
      maxTimeMS: 60000
    };
    
    await session.startTransaction(transactionOptions);

    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetNames = workbook.SheetNames;
    
    if (sheetNames.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Excel file has no sheets',
        errors: [{ message: 'The uploaded Excel file contains no sheets' }]
      });
    }

    // Process sheets as categories
    const allPlayers = [];
    const userPointsMap = new Map();
    const errors = [];
    const createdUsers = [];
    const categoryStats = [];
    const createdCategories = [];
    const generatedMemberIds = new Map(); // Track generated IDs to avoid duplicates in same session

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      if (data.length === 0) {
        categoryStats.push({
          categoryName: sheetName,
          playersProcessed: 0,
          status: 'empty'
        });
        continue;
      }

      // Detect category type from sheet name
      const categoryType = detectCategoryType(sheetName);

      // Create or find category
      let category;
      try {
        category = await Category.findOne({ name: sheetName }).session(session);
        if (!category) {
          category = new Category({
            name: sheetName,
            type: categoryType,
            description: `${sheetName} ${categoryType} category for ${name} tournament`
          });
          await category.save({ session });
          createdCategories.push({
            _id: category._id,
            name: category.name,
            type: category.type
          });
        } else {
          if (category.type !== categoryType) {
            category.type = categoryType;
            await category.save({ session });
          }
        }
      } catch (categoryError) {
        console.error(`Error creating/finding category ${sheetName}:`, categoryError);
        errors.push({
          category: sheetName,
          message: `Failed to create category: ${categoryError.message}`,
          status: 'failed'
        });
        continue;
      }

      let categoryPlayers = 0;
      let categoryErrors = 0;

      // Process data in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const batchPromises = [];

        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          const rowIndex = i + j;
          
          batchPromises.push(processCategoryRow(row, rowIndex, sheetName, category, session, userPointsMap, createdUsers, errors, generatedMemberIds));
        }

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            allPlayers.push(result.value);
            categoryPlayers++;
          } else {
            categoryErrors++;
          }
        });

        // Commit progress periodically to avoid timeout
        if (i % 100 === 0) {
          await session.commitTransaction();
          await session.startTransaction(transactionOptions);
        }
      }

      categoryStats.push({
        categoryName: sheetName,
        categoryType: category.type,
        playersProcessed: categoryPlayers,
        errors: categoryErrors,
        status: categoryPlayers > 0 ? 'processed' : 'skipped'
      });
    }

    if (allPlayers.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'No valid players found in any category',
        errors: errors,
        categoryStats
      });
    }

    // Create tournament
    const tournament = new Tournament({
      name,
      location: location || '',
      date: date || new Date(),
      players: allPlayers,
      categories: createdCategories.map(cat => cat._id),
      status: 'completed'
    });

    await tournament.save({ session });

    // Update user points by category in batches
    const userUpdatePromises = [];
    for (const [userKey, userData] of userPointsMap) {
      userUpdatePromises.push(updateUserCategoryPoints(userKey, userData, tournament, session));
    }

    await Promise.allSettled(userUpdatePromises);
    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully with categories',
      data: {
        tournament: {
          _id: tournament._id,
          name: tournament.name,
          location: tournament.location,
          date: tournament.date,
          playersCount: allPlayers.length,
          categoriesProcessed: categoryStats.filter(c => c.playersProcessed > 0).length
        },
        categories: categoryStats,
        createdCategories: createdCategories.length > 0 ? createdCategories : undefined,
        createdUsers: createdUsers.length > 0 ? createdUsers : undefined,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error('Error aborting transaction:', abortError);
      }
    }

    console.error('Create Tournament Error:', error);
    
    let userMessage = 'Server error';
    if (error.name === 'MongoNetworkError' || error.message.includes('ECONNRESET')) {
      userMessage = 'Database connection issue. Please try again.';
    } else if (error.name === 'MongoTimeoutError') {
      userMessage = 'Operation timed out. Please try with a smaller file.';
    }

    res.status(500).json({
      success: false,
      message: userMessage,
      errors: [{ message: error.message }]
    });
  } finally {
    if (session) {
      try {
        session.endSession();
      } catch (endError) {
        console.error('Error ending session:', endError);
      }
    }
    
    // Clean up uploaded file
    if (req.file && req.file.path) {
      const fs = require('fs');
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
  }
};

// Helper function to process a single row in category context
async function processCategoryRow(row, rowIndex, categoryName, category, session, userPointsMap, createdUsers, errors, generatedMemberIds) {
  try {
    // Extract data from row with exact column names
    let memberId = (row['Member ID1'] || '').toString().trim();
    let memberIdTwo = (row['Member ID2'] || '').toString().trim();
    const player1 = (row['Player1'] || '').toString().trim();
    const player2 = (row['Player2'] || '').toString().trim();
    const position = parseInt(row['Position'] || 0);
    const position2 = parseInt(row['Position2'] || position || 0);

    // Generate member IDs if missing but player name exists
    if (!memberId && player1) {
      // Check if we already generated an ID for this player in this session
      const existingId = generatedMemberIds.get(player1.toLowerCase());
      if (existingId) {
        memberId = existingId;
      } else {
        // Generate new unique ID and ensure it doesn't exist in database
        let newMemberId;
        let attempts = 0;
        const maxAttempts = 5;
        
        do {
          newMemberId = generateRandomMemberId();
          attempts++;
          // Check if this generated ID already exists in database
          const existingUser = await User.findOne({ qid: newMemberId }).session(session);
          if (!existingUser) {
            break;
          }
          newMemberId = null;
        } while (attempts < maxAttempts && !newMemberId);
        
        if (newMemberId) {
          memberId = newMemberId;
          generatedMemberIds.set(player1.toLowerCase(), memberId);
          console.log(`Generated member ID ${memberId} for player: ${player1}`);
        } else {
          errors.push({
            category: categoryName,
            row: rowIndex + 2,
            message: `Failed to generate unique member ID after ${maxAttempts} attempts for player: ${player1}`,
            data: { player1 }
          });
          return null;
        }
      }
    }

    // Generate member ID for player2 if missing (for doubles)
    if (category.type === 'doubles' && !memberIdTwo && player2) {
      const existingId = generatedMemberIds.get(player2.toLowerCase());
      if (existingId) {
        memberIdTwo = existingId;
      } else {
        let newMemberId;
        let attempts = 0;
        const maxAttempts = 5;
        
        do {
          newMemberId = generateRandomMemberId();
          attempts++;
          const existingUser = await User.findOne({ qid: newMemberId }).session(session);
          if (!existingUser) {
            break;
          }
          newMemberId = null;
        } while (attempts < maxAttempts && !newMemberId);
        
        if (newMemberId) {
          memberIdTwo = newMemberId;
          generatedMemberIds.set(player2.toLowerCase(), memberIdTwo);
          console.log(`Generated member ID ${memberIdTwo} for player: ${player2}`);
        } else {
          errors.push({
            category: categoryName,
            row: rowIndex + 2,
            message: `Failed to generate unique member ID after ${maxAttempts} attempts for player: ${player2}`,
            data: { player2 }
          });
          return null;
        }
      }
    }

    // Validate based on category type
    if (category.type === 'singles') {
      // For singles, we require at least player name
      if (!player1) {
        errors.push({
          category: categoryName,
          row: rowIndex + 2,
          message: 'Missing required player name for singles',
          data: { player1 }
        });
        return null;
      }
    } else if (category.type === 'doubles') {
      // For doubles, we require both player names
      if (!player1 || !player2) {
        errors.push({
          category: categoryName,
          row: rowIndex + 2,
          message: 'Missing required player names for doubles',
          data: { player1, player2 }
        });
        return null;
      }
    }

    const playersData = {
      category: category._id,
      categoryName: categoryName,
      categoryType: category.type,
      position,
      generatedMemberIds: [] // Track which IDs were generated
    };

    // Handle Player 1 (required for both singles and doubles)
    if (memberId && player1) {
      let user1 = await User.findOne({ qid: memberId }).session(session);
      const wasGenerated = memberId.startsWith('GEN');
      
      if (!user1) {
        user1 = new User({
          qid: memberId,
          name: player1,
        });
        await user1.save({ session });
        createdUsers.push({
          qid: memberId,
          name: player1,
          action: 'created',
          category: categoryName,
          generatedId: wasGenerated
        });
        
        if (wasGenerated) {
          playersData.generatedMemberIds.push(memberId);
        }
      }

      // Calculate and store points for user1 by category
      const points1 = POINTS_MAPPING[position] || 0;
      const userKey1 = `${user1._id.toString()}_${category._id.toString()}`;
      
      if (!userPointsMap.has(userKey1)) {
        userPointsMap.set(userKey1, {
          userId: user1._id,
          qid: memberId,
          name: player1,
          categoryId: category._id,
          categoryName: categoryName,
          categoryType: category.type,
          points: 0,
          positions: []
        });
      }
      const userData = userPointsMap.get(userKey1);
      userData.points += points1;
      userData.positions.push(position);

      playersData.memberId = memberId;
      playersData.player1 = player1;
      playersData.user1 = user1._id;
    }

    // Handle Player 2 (only for doubles)
    if (memberIdTwo && player2 && category.type === 'doubles') {
      let user2 = await User.findOne({ qid: memberIdTwo }).session(session);
      const wasGenerated = memberIdTwo.startsWith('GEN');
      
      if (!user2) {
        user2 = new User({
          qid: memberIdTwo,
          name: player2,
        });
        await user2.save({ session });
        createdUsers.push({
          qid: memberIdTwo,
          name: player2,
          action: 'created',
          category: categoryName,
          generatedId: wasGenerated
        });
        
        if (wasGenerated) {
          playersData.generatedMemberIds.push(memberIdTwo);
        }
      }

      // Calculate and store points for user2 by category
      const points2 = POINTS_MAPPING[position2] || 0;
      const userKey2 = `${user2._id.toString()}_${category._id.toString()}`;
      
      if (!userPointsMap.has(userKey2)) {
        userPointsMap.set(userKey2, {
          userId: user2._id,
          qid: memberIdTwo,
          name: player2,
          categoryId: category._id,
          categoryName: categoryName,
          categoryType: category.type,
          points: 0,
          positions: []
        });
      }
      const userData = userPointsMap.get(userKey2);
      userData.points += points2;
      userData.positions.push(position2);

      playersData.memberIdTwo = memberIdTwo;
      playersData.player2 = player2;
      playersData.user2 = user2._id;
      playersData.position2 = position2;
    }

    return playersData;

  } catch (error) {
    errors.push({
      category: categoryName,
      row: rowIndex + 2,
      message: `Error processing row: ${error.message}`,
      data: row
    });
    return null;
  }
}

// Helper function to update user points by category (same as before)
async function updateUserCategoryPoints(userKey, userData, tournament, session) {
  try {
    const user = await User.findById(userData.userId).session(session);
    if (user) {
      const categoryPointIndex = user.categoryPoints.findIndex(
        cp => cp.category && cp.category.toString() === userData.categoryId.toString()
      );

      if (categoryPointIndex >= 0) {
        user.categoryPoints[categoryPointIndex].points += userData.points;
      } else {
        user.categoryPoints.push({
          category: userData.categoryId,
          points: userData.points
        });
      }

      user.points = (user.points || 0) + userData.points;

      user.pointsHistory.push({
        tournament: tournament._id,
        category: userData.categoryId,
        categoryName: userData.categoryName,
        categoryType: userData.categoryType,
        pointsEarned: userData.points,
        position: Math.min(...userData.positions),
        date: tournament.date
      });

      await user.save({ session });
    }
  } catch (error) {
    console.error(`Error updating user ${userData.userId} for category ${userData.categoryId}:`, error);
    throw error;
  }
}

// Keep other functions with modifications for category support
exports.getAllTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find()
      .select('-__v -players')
      .populate('categories', 'name type')
      .sort({ date: -1 });

    // Add summary information
    const tournamentsWithSummary = tournaments.map(tournament => ({
      _id: tournament._id,
      name: tournament.name,
      date: tournament.date,
      location: tournament.location,
      status: tournament.status,
      categoriesCount: tournament.categories.length,
      categories: tournament.categories.map(cat => ({
        _id: cat._id,
        name: cat.name,
        type: cat.type
      }))
    }));

    res.status(200).json({
      success: true,
      message: 'Tournaments retrieved successfully',
      data: tournamentsWithSummary,
      count: tournaments.length
    });
  } catch (error) {
    console.error('Get All Tournaments Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

exports.getTournamentById = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournamentId)
      .select('-__v')
      .populate('categories', 'name type')
      .populate('players.user1', 'name qid points categoryPoints')
      .populate('players.user2', 'name qid points categoryPoints');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
        errors: [{ message: 'No tournament found with this ID' }]
      });
    }

    // Group players by category and structure the response
    const categoriesMap = new Map();
    
    // Initialize categories from tournament categories
    tournament.categories.forEach(cat => {
      categoriesMap.set(cat._id.toString(), {
        _id: cat._id,
        name: cat.name,
        type: cat.type,
        players: []
      });
    });

    // Group players by category
    tournament.players.forEach(player => {
      const categoryId = player.category.toString();
      if (categoriesMap.has(categoryId)) {
        const categoryData = categoriesMap.get(categoryId);
        
        // Calculate points for each player based on position
        const player1Points = POINTS_MAPPING[player.position] || 0;
        const player2Points = POINTS_MAPPING[player.position2] || 0;

        const playerEntry = {
          _id: player._id,
          memberId: player.memberId,
          memberIdTwo: player.memberIdTwo,
          player1: player.player1,
          player2: player.player2,
          position: player.position,
          position2: player.position2,
          points: player1Points, // Points for the team/entry
          user1: player.user1 ? {
            _id: player.user1._id,
            name: player.user1.name,
            qid: player.user1.qid,
            totalPoints: player.user1.points,
            categoryPoints: player.user1.categoryPoints.find(cp => 
              cp.category && cp.category.toString() === categoryId
            )?.points || 0
          } : null,
          user2: player.user2 ? {
            _id: player.user2._id,
            name: player.user2.name,
            qid: player.user2.qid,
            totalPoints: player.user2.points,
            categoryPoints: player.user2.categoryPoints.find(cp => 
              cp.category && cp.category.toString() === categoryId
            )?.points || 0
          } : null
        };

        categoryData.players.push(playerEntry);
      }
    });

    // Convert map to array and sort players by position
    const categories = Array.from(categoriesMap.values()).map(category => ({
      ...category,
      players: category.players.sort((a, b) => a.position - b.position)
    }));

    // Structure the final response
    const structuredTournament = {
      _id: tournament._id,
      name: tournament.name,
      date: tournament.date,
      location: tournament.location,
      status: tournament.status,
      categories: categories,
      totalPlayers: tournament.players.length,
      totalCategories: categories.length
    };

    res.status(200).json({
      success: true,
      message: 'Tournament retrieved successfully',
      data: structuredTournament
    });
  } catch (error) {
    console.error('Get Tournament Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

exports.deleteTournament = async (req, res) => {
  let session;
  
  try {
    session = await mongoose.startSession();
    const transactionOptions = {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' },
      maxTimeMS: 30000
    };
    
    await session.startTransaction(transactionOptions);

    const tournament = await Tournament.findById(req.params.tournamentId)
      .populate('categories')
      .session(session);

    if (!tournament) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
        errors: [{ message: 'No tournament found with this ID' }]
      });
    }

    // Revert user points by category
    const userIds = new Set();
    const categoryIds = tournament.categories.map(cat => cat._id.toString());
    
    tournament.players.forEach(player => {
      if (player.user1) userIds.add(player.user1.toString());
      if (player.user2) userIds.add(player.user2.toString());
    });

    const revertPromises = Array.from(userIds).map(userId => 
      revertUserCategoryPoints(userId, tournament._id, categoryIds, session)
    );

    await Promise.allSettled(revertPromises);
    await Tournament.findByIdAndDelete(req.params.tournamentId).session(session);
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Tournament deleted and points reverted successfully'
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error('Error aborting transaction:', abortError);
      }
    }
    
    console.error('Delete Tournament Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

async function revertUserCategoryPoints(userId, tournamentId, categoryIds, session) {
  try {
    const user = await User.findById(userId).session(session);
    if (user) {
      // Find history entries for this tournament
      const historyEntries = user.pointsHistory.filter(
        h => h.tournament.toString() === tournamentId.toString()
      );

      // Revert points for each category
      historyEntries.forEach(entry => {
        if (entry.category) {
          const currentPoints = user.categoryPoints.get(entry.category.toString()) || 0;
          const newPoints = Math.max(0, currentPoints - entry.pointsEarned);
          user.categoryPoints.set(entry.category.toString(), newPoints);
        }
        
        // Revert total points
        user.points = Math.max(0, (user.points || 0) - entry.pointsEarned);
      });

      // Remove history entries for this tournament
      user.pointsHistory = user.pointsHistory.filter(
        h => h.tournament.toString() !== tournamentId.toString()
      );

      await user.save({ session });
    }
  } catch (error) {
    console.error(`Error reverting points for user ${userId}:`, error);
    throw error;
  }
}