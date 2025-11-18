const Club = require('./clubModel');

// Get all clubs
exports.getAllClubs = async (req, res) => {
  try {
    const clubs = await Club.find()
      .select('-__v')
      .sort({ clubId: 1 }); 

    res.status(200).json({
      success: true,
      message: 'Clubs retrieved successfully',
      data: clubs,
      count: clubs.length
    });
  } catch (error) {
    console.error('Get All Clubs Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Get club by ID (using clubId)
exports.getClubById = async (req, res) => {
  try {
    const club = await Club.findById(req.params.clubId)
      .select('-__v');

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
        errors: [{ message: 'No club found with this ID' }]
      });
    }

    res.status(200).json({
      success: true,
      message: 'Club retrieved successfully',
      data: club
    });
  } catch (error) {
    console.error('Get Club By ID Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Get club by clubId (numeric)
exports.getClubByClubId = async (req, res) => {
  try {
    const clubId = parseInt(req.params.clubId);
    
    if (isNaN(clubId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid club ID',
        errors: [{ message: 'Club ID must be a number' }]
      });
    }

    const club = await Club.findOne({ clubId })
      .select('-__v');

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
        errors: [{ message: 'No club found with this club ID' }]
      });
    }

    res.status(200).json({
      success: true,
      message: 'Club retrieved successfully',
      data: club
    });
  } catch (error) {
    console.error('Get Club By ClubId Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Create new club with logo
exports.createClub = async (req, res) => {
  const { name, mobileNumbers, address, isActive } = req.body;

  try {
    // Check if logo file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'logo', message: 'Club logo is required' }]
      });
    }

    // Check for duplicate club name
    const existingClub = await Club.findOne({ name });
    if (existingClub) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'name', message: 'Club name already exists' }]
      });
    }

    const club = new Club({
      name,
      logo: req.file.filename, // Store the filename directly like in Product controller
      mobileNumbers: mobileNumbers || [],
      address: address || {},
      isActive: isActive !== undefined ? isActive : true
    });

    await club.save();

    const newClub = await Club.findById(club._id)
      .select('-__v');

    res.status(201).json({
      success: true,
      message: 'Club created successfully',
      data: newClub
    });
  } catch (error) {
    console.error('Create Club Error:', error.message);
    console.error('Full error:', error);
    
    if (error.name === 'ValidationError') {
      console.log('Validation errors:', error.errors);
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

// Update club by ID with logo
exports.updateClubById = async (req, res) => {
  const { name, isActive } = req.body;

  try {
    const club = await Club.findById(req.params.clubId);

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
        errors: [{ message: 'No club found with this ID' }]
      });
    }

    // Check for duplicate club name (excluding current club)
    if (name && name !== club.name) {
      const existingClub = await Club.findOne({ name, _id: { $ne: club._id } });
      if (existingClub) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'name', message: 'Club name already exists' }]
        });
      }
    }

    // Update logo if new file is uploaded
    if (req.file) {
      club.logo = req.file.filename;
    }

    // Update allowed fields
    if (name) club.name = name;
    if (isActive !== undefined) club.isActive = isActive;

    await club.save();

    const updatedClub = await Club.findById(club._id)
      .select('-__v');

    res.status(200).json({
      success: true,
      message: 'Club updated successfully',
      data: updatedClub
    });
  } catch (error) {
    console.error('Update Club Error:', error.message);
    
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

// Update club by clubId (numeric) with logo
exports.updateClubByClubId = async (req, res) => {
  const { name, isActive } = req.body;

  try {
    const clubId = parseInt(req.params.clubId);
    
    if (isNaN(clubId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid club ID',
        errors: [{ message: 'Club ID must be a number' }]
      });
    }

    const club = await Club.findOne({ clubId });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
        errors: [{ message: 'No club found with this club ID' }]
      });
    }

    // Check for duplicate club name (excluding current club)
    if (name && name !== club.name) {
      const existingClub = await Club.findOne({ name, _id: { $ne: club._id } });
      if (existingClub) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'name', message: 'Club name already exists' }]
        });
      }
    }

    // Update logo if new file is uploaded
    if (req.file) {
      club.logo = req.file.filename;
    }

    // Update allowed fields
    if (name) club.name = name;
    if (isActive !== undefined) club.isActive = isActive;

    await club.save();

    const updatedClub = await Club.findById(club._id)
      .select('-__v');

    res.status(200).json({
      success: true,
      message: 'Club updated successfully',
      data: updatedClub
    });
  } catch (error) {
    console.error('Update Club Error:', error.message);
    
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

// Delete club by ID
exports.deleteClubById = async (req, res) => {
  try {
    const club = await Club.findByIdAndDelete(req.params.clubId);

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
        errors: [{ message: 'No club found with this ID' }]
      });
    }

    res.status(200).json({
      success: true,
      message: 'Club deleted successfully'
    });
  } catch (error) {
    console.error('Delete Club Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Delete club by clubId (numeric)
exports.deleteClubByClubId = async (req, res) => {
  try {
    const clubId = parseInt(req.params.clubId);
    
    if (isNaN(clubId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid club ID',
        errors: [{ message: 'Club ID must be a number' }]
      });
    }

    const club = await Club.findOneAndDelete({ clubId });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
        errors: [{ message: 'No club found with this club ID' }]
      });
    }

    res.status(200).json({
      success: true,
      message: 'Club deleted successfully'
    });
  } catch (error) {
    console.error('Delete Club Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};