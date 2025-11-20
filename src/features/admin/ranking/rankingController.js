const User = require('../user/userModel');
const Tournament = require('../tournament/tournamentModel')
const Category = require('../category/categoryModel')
const mongoose = require('mongoose');


const POINTS_MAPPING = {
  1: 100, 2: 75, 3: 50, 4: 50, 5: 25, 6: 25, 7: 25, 8: 25,
  9: 15, 10: 15, 11: 15, 12: 15, 13: 15, 14: 15, 15: 15, 16: 15
};

// Get overall rankings across all categories
exports.getOverallRankings = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const users = await User.find({ isActive: true })
      .select('name qid club totalPoints categoryPoints')
      .populate('club', 'name')
      .sort({ totalPoints: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments({ isActive: true });

    // Add ranking position
    const usersWithRanking = users.map((user, index) => ({
      rank: skip + index + 1,
      ...user.toObject()
    }));

    res.status(200).json({
      success: true,
      message: 'Overall rankings retrieved successfully',
      data: {
        users: usersWithRanking,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasNext: skip + users.length < totalUsers,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get Overall Rankings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};



// Universal rankings controller that accepts categoryId, tournamentId, or both
exports.getUniversalRankings = async (req, res) => {
  try {
    const { categoryId, tournamentId, limit = 50, page = 1, type } = req.query;
    const skip = (page - 1) * limit;

    // Validate input parameters
    if (!categoryId && !tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing parameters',
        errors: [{ message: 'Please provide either categoryId, tournamentId, or both' }]
      });
    }

    let result;
    let message = 'Rankings retrieved successfully';

    // Case 1: Both categoryId and tournamentId provided
    if (categoryId && tournamentId) {
      result = await getTournamentCategoryRankings(categoryId, tournamentId, skip, parseInt(limit));
      message = `Tournament category rankings retrieved successfully`;
    }
    // Case 2: Only tournamentId provided
    else if (tournamentId) {
      result = await getTournamentRankings(tournamentId, skip, parseInt(limit), type);
      message = `Tournament rankings retrieved successfully`;
    }
    // Case 3: Only categoryId provided
    else if (categoryId) {
      result = await getCategoryRankings(categoryId, skip, parseInt(limit), type);
      message = `Category rankings retrieved successfully`;
    }

    res.status(200).json({
      success: true,
      message,
      data: result
    });

  } catch (error) {
    console.error('Get Universal Rankings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Helper function: Get rankings for specific category in specific tournament
async function getTournamentCategoryRankings(categoryId, tournamentId, skip, limit) {
  // Validate category and tournament
  const [category, tournament] = await Promise.all([
    Category.findById(categoryId),
    Tournament.findById(tournamentId)
      .populate('categories', 'name type')
      .populate('players.user1', 'name qid')
      .populate('players.user2', 'name qid')
  ]);

  if (!category) {
    throw new Error('Category not found');
  }
  if (!tournament) {
    throw new Error('Tournament not found');
  }

  // Filter players for the specific category
  const categoryPlayers = tournament.players.filter(player => 
    player.category.toString() === categoryId
  );

  const playersWithPoints = [];

  // Process players and calculate points
  categoryPlayers.forEach(player => {
    const points = POINTS_MAPPING[player.position] || 0;

    // Singles category
    if (category.type === 'singles' && player.user1) {
      playersWithPoints.push({
        user: player.user1,
        memberId: player.memberId,
        position: player.position,
        points: points,
        categoryType: 'singles'
      });
    }
    // Doubles category
    else if (category.type === 'doubles') {
      if (player.user1) {
        playersWithPoints.push({
          user: player.user1,
          memberId: player.memberId,
          position: player.position,
          points: points,
          partner: player.user2,
          categoryType: 'doubles'
        });
      }
      if (player.user2) {
        playersWithPoints.push({
          user: player.user2,
          memberId: player.memberIdTwo,
          position: player.position2,
          points: points,
          partner: player.user1,
          categoryType: 'doubles'
        });
      }
    }
  });

  // Sort by points and apply pagination
  playersWithPoints.sort((a, b) => b.points - a.points);
  const paginatedPlayers = playersWithPoints.slice(skip, skip + limit);

  // Add ranking position
  const rankedPlayers = paginatedPlayers.map((player, index) => ({
    rank: skip + index + 1,
    ...player
  }));

  return {
    category: {
      _id: category._id,
      name: category.name,
      type: category.type
    },
    tournament: {
      _id: tournament._id,
      name: tournament.name,
      start_date: tournament.start_date,
      end_date: tournament.end_date
    },
    players: rankedPlayers,
    pagination: {
      currentPage: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(playersWithPoints.length / limit),
      totalPlayers: playersWithPoints.length,
      hasNext: skip + rankedPlayers.length < playersWithPoints.length,
      hasPrev: skip > 0
    }
  };
}

// Helper function: Get rankings for entire tournament (all categories)
async function getTournamentRankings(tournamentId, skip, limit, type) {
  const tournament = await Tournament.findById(tournamentId)
    .populate('categories', 'name type')
    .populate('players.user1', 'name qid')
    .populate('players.user2', 'name qid');

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  const userPointsMap = new Map();

  // Calculate points for all users in the tournament
  tournament.players.forEach(player => {
    const points = POINTS_MAPPING[player.position] || 0;
    const category = tournament.categories.find(c => c._id.toString() === player.category.toString());

    // Filter by type if specified
    if (type && category.type !== type) {
      return;
    }

    // Process player 1
    if (player.user1) {
      const userId = player.user1._id.toString();
      if (!userPointsMap.has(userId)) {
        userPointsMap.set(userId, {
          user: player.user1,
          totalPoints: 0,
          categories: []
        });
      }
      const userData = userPointsMap.get(userId);
      userData.totalPoints += points;
      userData.categories.push({
        category: category,
        points: points,
        position: player.position
      });
    }

    // Process player 2 (for doubles)
    if (player.user2) {
      const userId = player.user2._id.toString();
      if (!userPointsMap.has(userId)) {
        userPointsMap.set(userId, {
          user: player.user2,
          totalPoints: 0,
          categories: []
        });
      }
      const userData = userPointsMap.get(userId);
      userData.totalPoints += points;
      userData.categories.push({
        category: category,
        points: points,
        position: player.position2
      });
    }
  });

  // Convert to array and sort
  const usersWithPoints = Array.from(userPointsMap.values());
  usersWithPoints.sort((a, b) => b.totalPoints - a.totalPoints);

  // Apply pagination
  const paginatedUsers = usersWithPoints.slice(skip, skip + limit);

  // Add ranking position
  const rankedUsers = paginatedUsers.map((user, index) => ({
    rank: skip + index + 1,
    ...user
  }));

  return {
    tournament: {
      _id: tournament._id,
      name: tournament.name,
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      location: tournament.location
    },
    users: rankedUsers,
    pagination: {
      currentPage: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(usersWithPoints.length / limit),
      totalUsers: usersWithPoints.length,
      hasNext: skip + rankedUsers.length < usersWithPoints.length,
      hasPrev: skip > 0
    }
  };
}

// Helper function: Get rankings for specific category (across all tournaments)
async function getCategoryRankings(categoryId, skip, limit, type) {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new Error('Category not found');
  }

  // Filter by type if specified and it matches category type
  if (type && category.type !== type) {
    return {
      category: {
        _id: category._id,
        name: category.name,
        type: category.type
      },
      users: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalUsers: 0,
        hasNext: false,
        hasPrev: false
      }
    };
  }

  const aggregationPipeline = [
    { 
      $match: { 
        isActive: true,
        'categoryPoints.category': new mongoose.Types.ObjectId(categoryId)
      } 
    },
    {
      $addFields: {
        categoryPoint: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$categoryPoints',
                as: 'cp',
                cond: {
                  $eq: ['$$cp.category', new mongoose.Types.ObjectId(categoryId)]
                }
              }
            },
            0
          ]
        }
      }
    },
    {
      $project: {
        name: 1,
        qid: 1,
        club: 1,
        totalPoints: 1,
        categoryPoints: '$categoryPoint'
      }
    },
    { $sort: { 'categoryPoints.points': -1 } },
    { $skip: skip },
    { $limit: limit }
  ];

  const [users, totalUsers] = await Promise.all([
    User.aggregate(aggregationPipeline),
    User.countDocuments({
      isActive: true,
      'categoryPoints.category': new mongoose.Types.ObjectId(categoryId)
    })
  ]);

  // Populate club information
  const populatedUsers = await User.populate(users, { path: 'club', select: 'name' });

  // Add ranking position
  const usersWithRanking = populatedUsers.map((user, index) => ({
    rank: skip + index + 1,
    _id: user._id,
    name: user.name,
    qid: user.qid,
    club: user.club,
    totalPoints: user.totalPoints || 0,
    categoryPoints: user.categoryPoints || { points: 0, tournamentsCount: 0 }
  }));

  return {
    category: {
      _id: category._id,
      name: category.name,
      type: category.type
    },
    users: usersWithRanking,
    pagination: {
      currentPage: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers: totalUsers,
      hasNext: skip + users.length < totalUsers,
      hasPrev: skip > 0
    }
  };
}



// Get rankings by specific category - SIMPLER VERSION
exports.getCategoryRankings = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // Validate category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
        errors: [{ message: 'No category found with this ID' }]
      });
    }

    // Get all users with this category and sort by category points
    const allUsers = await User.find({
      isActive: true,
      'categoryPoints.category': new mongoose.Types.ObjectId(categoryId)
    })
    .select('name qid club totalPoints categoryPoints')
    .populate('club', 'name')
    .lean(); // Use lean() for plain JavaScript objects

    // Sort users by their points in this specific category
    const sortedUsers = allUsers
      .map(user => {
        // Find the category points for this specific category
        const categoryPoint = user.categoryPoints.find(cp => 
          cp.category && cp.category.toString() === categoryId
        ) || { points: 0, tournamentsCount: 0 };

        return {
          ...user,
          categoryPoint: categoryPoint
        };
      })
      .sort((a, b) => b.categoryPoint.points - a.categoryPoint.points);

    // Apply pagination
    const paginatedUsers = sortedUsers.slice(skip, skip + parseInt(limit));

    // Add ranking position
    const usersWithRanking = paginatedUsers.map((user, index) => ({
      rank: skip + index + 1,
      _id: user._id,
      name: user.name,
      qid: user.qid,
      club: user.club,
      totalPoints: user.totalPoints,
      categoryPoints: user.categoryPoint
    }));

    res.status(200).json({
      success: true,
      message: `Rankings for ${category.name} retrieved successfully`,
      data: {
        category: {
          _id: category._id,
          name: category.name,
          type: category.type
        },
        users: usersWithRanking,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(sortedUsers.length / limit),
          totalUsers: sortedUsers.length,
          hasNext: skip + paginatedUsers.length < sortedUsers.length,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get Category Rankings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Get tournament-specific rankings
exports.getTournamentRankings = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { categoryId } = req.query;

    const tournament = await Tournament.findById(tournamentId)
      .populate('categories', 'name type')
      .populate('players.user1', 'name qid')
      .populate('players.user2', 'name qid');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
        errors: [{ message: 'No tournament found with this ID' }]
      });
    }

    let rankings = [];
    const categoryMap = new Map();

    // Group by category
    tournament.players.forEach(player => {
      const catId = player.category.toString();
      if (!categoryMap.has(catId)) {
        const category = tournament.categories.find(c => c._id.toString() === catId);
        categoryMap.set(catId, {
          category: category,
          players: []
        });
      }

      const categoryData = categoryMap.get(catId);
      const points = POINTS_MAPPING[player.position] || 0;

      // For singles
      if (player.categoryType === 'singles' && player.user1) {
        categoryData.players.push({
          user: player.user1,
          memberId: player.memberId,
          position: player.position,
          points: points
        });
      }
      
      // For doubles - create entries for both players
      if (player.categoryType === 'doubles') {
        if (player.user1) {
          categoryData.players.push({
            user: player.user1,
            memberId: player.memberId,
            position: player.position,
            points: points,
            partner: player.user2
          });
        }
        if (player.user2) {
          categoryData.players.push({
            user: player.user2,
            memberId: player.memberIdTwo,
            position: player.position2,
            points: points,
            partner: player.user1
          });
        }
      }
    });

    // Sort players by points within each category
    categoryMap.forEach((categoryData, catId) => {
      categoryData.players.sort((a, b) => b.points - a.points);
      
      // Add ranking position
      const playersWithRank = categoryData.players.map((player, index) => ({
        rank: index + 1,
        ...player
      }));

      if (!categoryId || catId === categoryId) {
        rankings.push({
          category: categoryData.category,
          players: playersWithRank
        });
      }
    });

    res.status(200).json({
      success: true,
      message: 'Tournament rankings retrieved successfully',
      data: {
        tournament: {
          _id: tournament._id,
          name: tournament.name,
          date: tournament.date
        },
        rankings: rankings
      }
    });
  } catch (error) {
    console.error('Get Tournament Rankings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Get user's detailed points breakdown
exports.getUserPointsBreakdown = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('name qid totalPoints categoryPoints pointsHistory')
      .populate('categoryPoints.category', 'name type')
      .populate('pointsHistory.tournament', 'name date')
      .populate('pointsHistory.category', 'name type');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errors: [{ message: 'No user found with this ID' }]
      });
    }

    // Calculate category rankings
    const categoryBreakdown = await Promise.all(
      user.categoryPoints.map(async (cp) => {
        const categoryRank = await User.countDocuments({
          'categoryPoints.category': cp.category,
          'categoryPoints.points': { $gt: cp.points },
          isActive: true
        });
        
        return {
          category: cp.category,
          points: cp.points,
          tournamentsCount: cp.tournamentsCount,
          rank: categoryRank + 1,
          lastUpdated: cp.lastUpdated
        };
      })
    );

    // Group points history by tournament
    const tournamentBreakdown = user.pointsHistory.reduce((acc, history) => {
      const tournamentId = history.tournament._id.toString();
      if (!acc[tournamentId]) {
        acc[tournamentId] = {
          tournament: history.tournament,
          categories: [],
          totalPoints: 0
        };
      }
      
      acc[tournamentId].categories.push({
        category: history.category,
        pointsEarned: history.pointsEarned,
        position: history.position,
        date: history.date
      });
      
      acc[tournamentId].totalPoints += history.pointsEarned;
      
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: 'User points breakdown retrieved successfully',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          qid: user.qid,
          totalPoints: user.totalPoints
        },
        categoryBreakdown,
        tournamentBreakdown: Object.values(tournamentBreakdown)
      }
    });
  } catch (error) {
    console.error('Get User Points Breakdown Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Get rankings by category type (singles/doubles)
exports.getRankingsByType = async (req, res) => {
  try {
    const { type } = req.params; // 'singles' or 'doubles'
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    if (!['singles', 'doubles'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category type',
        errors: [{ message: 'Type must be either "singles" or "doubles"' }]
      });
    }

    const users = await User.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$categoryPoints' },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryPoints.category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      { $match: { 'categoryInfo.type': type } },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          qid: { $first: '$qid' },
          totalPointsByType: { $sum: '$categoryPoints.points' },
          categories: { $push: '$categoryPoints' }
        }
      },
      { $sort: { totalPointsByType: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    const totalUsers = await User.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$categoryPoints' },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryPoints.category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      { $match: { 'categoryInfo.type': type } },
      { $group: { _id: '$_id' } },
      { $count: 'total' }
    ]);

    const totalCount = totalUsers.length > 0 ? totalUsers[0].total : 0;

    // Add ranking position
    const usersWithRanking = users.map((user, index) => ({
      rank: skip + index + 1,
      ...user
    }));

    res.status(200).json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} rankings retrieved successfully`,
      data: {
        type,
        users: usersWithRanking,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalUsers: totalCount,
          hasNext: skip + users.length < totalCount,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get Rankings By Type Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};  


// Search rankings by user name or QID
// exports.searchRankings = async (req, res) => {
//   try {
//     const { query, limit = 50, page = 1 } = req.query;
//     const skip = (page - 1) * limit;
//     if (!query) {
//       return res.status(400).json({
//         success: false,
//         message: 'Search query is required',
//         errors: [{ message: 'Please provide a search query parameter' }]
//       });
//     }
//     const regex = new RegExp(query, 'i'); 

//     const users = await User.find({
//       isActive: true,
//       $or: [
//         { name: regex },
//         { qid: regex }
//       ]
//     })  .select('name qid club totalPoints categoryPoints')
//       .populate('club', 'name')
//       .sort({ totalPoints: -1 })
//       .skip(skip)
//       .limit(parseInt(limit));
//     const totalUsers = await User.countDocuments({
//       isActive: true,
//       $or: [
//         { name: regex },
//         { qid: regex }
//       ]
//     }); 
//     // Add ranking position
//     const usersWithRanking = users.map((user, index) => ({
//       rank: skip + index + 1,
//       ...user.toObject()
//     }));
//     res.status(200).json({
//       success: true,
//       message: 'Search results retrieved successfully', 
//       data: {
//         users: usersWithRanking,
//         pagination: {   
//           currentPage: parseInt(page),
//           totalPages: Math.ceil(totalUsers / limit),
//           totalUsers,
//           hasNext: skip + users.length < totalUsers,
//           hasPrev: page > 1
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Search Rankings Error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       errors: [{ message: error.message }]
//     });
//   }
// };

exports.searchRankings = async (req, res) => {
  try {    
    const search=req.query.q;
    const users=await User.find({$or:[{name:{$regex:search,$options:'i'}},{qid:{$regex:search,$options:'i'}}] })
    console.log(users,"jhj");

    if(users.length===0){
      return res.status(404).json({ success: false, message: 'No users found' });
    }
    

    res.json({success:true,message:'Search results retrieved successfully',data:users})
    if(!users){
      return res.status(404).json({ success: false, message: 'No users found matching the search criteria' });
    }
    
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });    
  }

}


