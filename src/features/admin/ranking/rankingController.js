const User = require('../user/userModel');
const Tournament = require('../tournament/tournamentModel');
const Category = require('../category/categoryModel');
const mongoose = require('mongoose');

const POINTS_MAPPING = {
  1: 100, 2: 75, 3: 50, 4: 50, 5: 25, 6: 25, 7: 25, 8: 25,
  9: 15, 10: 15, 11: 15, 12: 15, 13: 15, 14: 15, 15: 15, 16: 15
};

class RankingService {
  /**
   * Apply professional ranking with ties
   * Same points = same rank, next rank skips tied positions
   */
  static applyRanking(items, pointsField = 'points') {
    if (!items.length) return [];

    // Sort by points descending
    const sorted = [...items].sort((a, b) => b[pointsField] - a[pointsField]);

    let currentRank = 1;
    let currentPoints = sorted[0][pointsField];
    
    sorted[0].rank = currentRank;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i][pointsField] === currentPoints) {
        // Same points, same rank
        sorted[i].rank = currentRank;
      } else {
        // Different points, next rank
        currentRank = i + 1;
        sorted[i].rank = currentRank;
        currentPoints = sorted[i][pointsField];
      }
    }

    return sorted;
  }

  static async getTournamentCategoryRankings(categoryId, tournamentId, limit = 50, page = 1) {
    const skip = (page - 1) * limit;

    const tournament = await Tournament.findById(tournamentId)
      .populate('categories', 'name type')
      .populate('players.user1', 'name qid')
      .populate('players.user2', 'name qid')
      .lean();

    if (!tournament) throw new Error('Tournament not found');

    const category = tournament.categories.find(c => c._id.toString() === categoryId);
    if (!category) throw new Error('Category not found in tournament');

    // Process all players in this category
    const playersWithPoints = tournament.players
      .filter(player => player.category.toString() === categoryId)
      .map(player => ({
        user: player.user1,
        memberId: player.memberId,
        position: player.position,
        points: POINTS_MAPPING[player.position] || 0,
        partner: category.type === 'doubles' ? player.user2 : null,
        categoryType: category.type
      }))
      .filter(player => player.user); // Remove null users

    // Apply ranking
    const rankedPlayers = this.applyRanking(playersWithPoints);

    const paginatedPlayers = rankedPlayers.slice(skip, skip + limit);

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
      players: paginatedPlayers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(rankedPlayers.length / limit),
        totalPlayers: rankedPlayers.length,
        hasNext: skip + limit < rankedPlayers.length,
        hasPrev: page > 1
      }
    };
  }

  static async getCategoryRankings(categoryId, limit = 50, page = 1) {
    const skip = (page - 1) * limit;

    const category = await Category.findById(categoryId).lean();
    if (!category) throw new Error('Category not found');

    const users = await User.find({
      isActive: true,
      'categoryPoints.category': new mongoose.Types.ObjectId(categoryId)
    })
    .select('name qid club totalPoints categoryPoints')
    .populate('club', 'name')
    .lean();

    // Extract category points and prepare for ranking
    const usersWithPoints = users.map(user => {
      const categoryPoint = user.categoryPoints.find(cp => 
        cp.category && cp.category.toString() === categoryId
      ) || { points: 0, tournamentsCount: 0 };

      return {
        ...user,
        points: categoryPoint.points,
        tournamentsCount: categoryPoint.tournamentsCount
      };
    });

    // Apply ranking
    const rankedUsers = this.applyRanking(usersWithPoints, 'points');
    const paginatedUsers = rankedUsers.slice(skip, skip + limit);

    return {
      category: {
        _id: category._id,
        name: category.name,
        type: category.type
      },
      users: paginatedUsers.map(user => ({
        rank: user.rank,
        _id: user._id,
        name: user.name,
        qid: user.qid,
        club: user.club,
        totalPoints: user.totalPoints,
        points: user.points,
        tournamentsCount: user.tournamentsCount
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(rankedUsers.length / limit),
        totalUsers: rankedUsers.length,
        hasNext: skip + limit < rankedUsers.length,
        hasPrev: page > 1
      }
    };
  }

  static async getTournamentRankings(tournamentId, limit = 50, page = 1) {
    const skip = (page - 1) * limit;

    const tournament = await Tournament.findById(tournamentId)
      .populate('categories', 'name type')
      .populate('players.user1', 'name qid club')
      .populate('players.user2', 'name qid club')
      .lean();

    if (!tournament) throw new Error('Tournament not found');

    // Calculate total points per user
    const userPointsMap = new Map();

    tournament.players.forEach(player => {
      const points = POINTS_MAPPING[player.position] || 0;

      if (player.user1) {
        const userId = player.user1._id.toString();
        const current = userPointsMap.get(userId) || { user: player.user1, points: 0 };
        userPointsMap.set(userId, { ...current, points: current.points + points });
      }

      if (player.user2) {
        const userId = player.user2._id.toString();
        const current = userPointsMap.get(userId) || { user: player.user2, points: 0 };
        userPointsMap.set(userId, { ...current, points: current.points + points });
      }
    });

    const usersWithPoints = Array.from(userPointsMap.values());
    const rankedUsers = this.applyRanking(usersWithPoints, 'points');
    const paginatedUsers = rankedUsers.slice(skip, skip + limit);

    return {
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        start_date: tournament.start_date,
        end_date: tournament.end_date
      },
      users: paginatedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(rankedUsers.length / limit),
        totalUsers: rankedUsers.length,
        hasNext: skip + limit < rankedUsers.length,
        hasPrev: page > 1
      }
    };
  }

  static async getOverallRankings(limit = 50, page = 1) {
    const skip = (page - 1) * limit;

    const [users, totalUsers] = await Promise.all([
      User.find({ isActive: true })
        .select('name qid club totalPoints')
        .populate('club', 'name')
        .sort({ totalPoints: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments({ isActive: true })
    ]);

    // Apply ranking to overall points
    const rankedUsers = this.applyRanking(users.map(u => ({ ...u, points: u.totalPoints })), 'points');

    return {
      users: rankedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNext: skip + users.length < totalUsers,
        hasPrev: page > 1
      }
    };
  }
}

// Clean Controller Exports
exports.getOverallRankings = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const result = await RankingService.getOverallRankings(limit, page);

    res.status(200).json({
      success: true,
      message: 'Overall rankings retrieved successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getUniversalRankings = async (req, res) => {
  try {
    const { categoryId, tournamentId, limit = 50, page = 1 } = req.query;

    if (!categoryId && !tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either categoryId or tournamentId'
      });
    }

    let result;
    let message = 'Rankings retrieved successfully';

    if (categoryId && tournamentId) {
      result = await RankingService.getTournamentCategoryRankings(categoryId, tournamentId, limit, page);
      message = 'Tournament category rankings retrieved successfully';
    } else if (tournamentId) {
      result = await RankingService.getTournamentRankings(tournamentId, limit, page);
      message = 'Tournament rankings retrieved successfully';
    } else {
      result = await RankingService.getCategoryRankings(categoryId, limit, page);
      message = 'Category rankings retrieved successfully';
    }

    res.status(200).json({
      success: true,
      message,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Backward compatibility
exports.getCategoryRankings = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const result = await RankingService.getCategoryRankings(categoryId, limit, page);

    res.status(200).json({
      success: true,
      message: `Rankings for ${result.category.name} retrieved successfully`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getTournamentRankings = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { categoryId, limit = 50, page = 1 } = req.query;

    let result;
    if (categoryId) {
      result = await RankingService.getTournamentCategoryRankings(categoryId, tournamentId, limit, page);
    } else {
      result = await RankingService.getTournamentRankings(tournamentId, limit, page);
    }

    res.status(200).json({
      success: true,
      message: 'Tournament rankings retrieved successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};