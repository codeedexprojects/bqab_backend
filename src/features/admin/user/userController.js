const User = require('./userModel');
const mongoose = require('mongoose');
const Tournament = require('../tournament/tournamentModel')


// Position display mapping
const POSITION_DISPLAY_MAPPING = {
  1: 'Winner',
  2: 'Runner-Up',
  3: 'Semifinal',
  4: 'Semifinal',
  5: 'Quarter Final',
  6: 'Quarter Final',
  7: 'Quarter Final',
  8: 'Quarter Final',
  9: 'Pre-Quarter',
  10: 'Pre-Quarter',
  11: 'Pre-Quarter',
  12: 'Pre-Quarter',
  13: 'Pre-Quarter',
  14: 'Pre-Quarter',
  15: 'Pre-Quarter',
  16: 'Pre-Quarter'
};

// Helper function to get display position
const getDisplayPosition = (position) => {
  return POSITION_DISPLAY_MAPPING[position] || (position ? position.toString() : '');
};

// Create a new user
exports.createUser = async (req, res) => {
  try {
    const {
      name,
      qid,
      club,
      country,
      dob,
      gender,
      mobile,
      level,
      passport,
      role = 'customer',
      isActive = true
    } = req.body;

    // Check for duplicate mobile number if provided
    if (mobile) {
      const existingUser = await User.findOne({ mobile });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'mobile', message: 'Mobile number already exists' }]
        });
      }
    }

    // Validate mobile format if provided
    if (mobile && !/^[0-9]{10,15}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'mobile', message: 'Mobile number must be 10-15 digits' }]
      });
    }

    // Validate gender enum if provided
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'gender', message: 'Gender must be male, female, or other' }]
      });
    }

    // Validate level enum if provided
    if (level && !['a', 'b', 'c', 'd', 'e', 'open'].includes(level)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'level', message: 'Level must be a, b, c, d, e, or open' }]
      });
    }

    // Create new user
    const newUser = new User({
      name,
      qid,
      club,
      country,
      passport,
      dob,
      gender,
      mobile,
      level,
      role,
      isActive
    });

    await newUser.save();

    // Fetch the created user without sensitive fields
    const createdUser = await User.findById(newUser._id)
      .select('-__v')
      .populate('club', 'name');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: createdUser
    });

  } catch (error) {
    console.error('Create User Error:', error.message);
    
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field, message: `${field} already exists` }]
      });
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Keep other functions (getAllUsers, getUserById, updateUserById, deleteUserById) the same
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-__v')
      .populate('club', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Get All Users Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    // Get basic user info with club details
    const user = await User.findById(req.params.userId)
      .select('-__v')
      .populate('club', 'name');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errors: [{ message: 'No user found with this ID' }]
      });
    }

    // Get all tournaments where this user participated
    const userTournaments = await Tournament.find({
      $or: [
        { 'players.user1': user._id },
        { 'players.user2': user._id }
      ]
    })
    .populate('categories', 'name type')
    .select('name date location status players categories')
    .sort({ date: -1 });

    // Group data by category first, then tournaments within each category
    const categoryMap = new Map();

    userTournaments.forEach(tournament => {
      // Find all categories user participated in this tournament
      const userEntries = tournament.players.filter(player => 
        player.user1?.toString() === user._id.toString() || 
        player.user2?.toString() === user._id.toString()
      );

      userEntries.forEach(entry => {
        const categoryId = entry.category?.toString();
        
        if (!categoryId) return;

        // Get or create category entry
        if (!categoryMap.has(categoryId)) {
          // Find category details from tournament categories or use entry data
          const categoryDetails = tournament.categories.find(cat => 
            cat._id.toString() === categoryId
          ) || {
            _id: entry.category,
            name: entry.categoryName || 'Unknown Category',
            type: entry.categoryType || 'singles'
          };

          categoryMap.set(categoryId, {
            category: {
              _id: categoryDetails._id,
              name: categoryDetails.name,
              type: categoryDetails.type
            },
            totalPoints: 0,
            tournaments: []
          });
        }

        const categoryData = categoryMap.get(categoryId);
        
        // Calculate points for this tournament entry
        const pointsEarned = user.pointsHistory.find(ph => 
          ph.tournament?.toString() === tournament._id.toString() &&
          ph.category?.toString() === categoryId
        )?.pointsEarned || 0;

        // Add points to category total
        categoryData.totalPoints += pointsEarned;

        // Create tournament entry
const tournamentEntry = {
  tournament: {
    _id: tournament._id,
    name: tournament.name,
    date: tournament.date,
    location: tournament.location,
    status: tournament.status
  },
  participation: {
    position: entry.position, 
    position2: entry.position2,
    displayPosition: getDisplayPosition(entry.position), 
    displayPosition2: getDisplayPosition(entry.position2), 
    memberId: entry.user1?.toString() === user._id.toString() ? entry.memberId : entry.memberIdTwo,
    pointsEarned: pointsEarned,
    // Partner info for doubles
    partner: entry.categoryType === 'doubles' ? {
      userId: entry.user1?.toString() === user._id.toString() ? entry.user2 : entry.user1,
      name: entry.user1?.toString() === user._id.toString() ? entry.player2 : entry.player1,
      memberId: entry.user1?.toString() === user._id.toString() ? entry.memberIdTwo : entry.memberId
    } : null
  }
};

        categoryData.tournaments.push(tournamentEntry);
      });
    });

    // Convert map to array and sort tournaments by date within each category
    const categoriesWithTournaments = Array.from(categoryMap.values()).map(categoryData => ({
      ...categoryData,
      tournaments: categoryData.tournaments.sort((a, b) => new Date(b.tournament.date) - new Date(a.tournament.date))
    }));

    // Calculate summary statistics
    const totalTournaments = new Set();
    userTournaments.forEach(tournament => {
      totalTournaments.add(tournament._id.toString());
    });

    // Format the response as requested - Category first, then tournaments
    const response = {
      // User basic information
      user: {
        _id: user._id,
        name: user.name,
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
        updatedAt: user.updatedAt
      },
      
      // Category-wise participation (grouped by category)
      categoryParticipation: categoriesWithTournaments,
      
      // Summary statistics
      summary: {
        totalTournaments: totalTournaments.size,
        totalCategories: categoriesWithTournaments.length,
        totalPoints: user.points,
        pointsByCategory: user.categoryPoints.map(cp => ({
          categoryId: cp.category,
          points: cp.points
        }))
      }
    };

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: response
    });
  } catch (error) {
    console.error('Get User By ID Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

exports.updateUserById = async (req, res) => {
  const {
    name,
    qid,
    club,
    country,
    dob,
    passport,
    gender,
    mobile,
    level,
    role,
    isActive
  } = req.body;

  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errors: [{ message: 'No user found with this ID' }]
      });
    }

    // Check for duplicate mobile number
    if (mobile && mobile !== user.mobile) {
      const existingUser = await User.findOne({ mobile, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'mobile', message: 'Mobile number already exists' }]
        });
      }
    }

    // Update allowed fields
    if (name !== undefined) user.name = name;
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
      .select('-__v')
      .populate('club', 'name');

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update User Error:', error.message);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field, message: `${field} already exists` }]
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

exports.deleteUserById = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errors: [{ message: 'No user found with this ID' }]
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete User Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};