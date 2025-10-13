const User = require('./userModel');
const mongoose = require('mongoose');

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

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: user
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