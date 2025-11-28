const Umpire = require('./umpireModel');
const Tournament = require('../tournament/tournamentModel');
const mongoose = require('mongoose');

// Get all umpires with filtering and pagination
exports.getAllUmpires = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      country,
      level,
      gender,
      isActive,
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Search by name or passport
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { passport: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by country
    if (country) {
      query.country = { $regex: country, $options: 'i' };
    }



    // Filter by gender
    if (gender) {
      query.gender = gender;
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

 

    const [umpires, totalCount] = await Promise.all([
      Umpire.find(query)
        .select('-__v')
        .populate('assignedTournaments.tournament', 'name start_date end_date location')
        .populate('assignedTournaments.categories', 'name type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Umpire.countDocuments(query)
    ]);

    // Format response
    const formattedUmpires = umpires.map(umpire => ({
      _id: umpire._id,
      umpireId: umpire.umpireId,
      name: umpire.name,
      country: umpire.country,
      passport: umpire.passport,
      gender: umpire.gender,
      mobileNumber: umpire.mobileNumber,
      QID: umpire.QID,
      isActive: umpire.isActive,
      assignedTournamentsCount: umpire.assignedTournaments.length,
      assignedTournaments: umpire.assignedTournaments.map(at => ({
        tournament: at.tournament,
        assignedDate: at.assignedDate,
        role: at.role,
        categories: at.categories
      })),
      createdAt: umpire.createdAt,
      updatedAt: umpire.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: 'Umpires retrieved successfully',
      data: {
        umpires: formattedUmpires,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalUmpires: totalCount,
          hasNext: skip + umpires.length < totalCount,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get All Umpires Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Get umpire by ID
exports.getUmpireById = async (req, res) => {
  try {
    const umpire = await Umpire.findById(req.params.id)
      .select('-__v')
      .populate('assignedTournaments.tournament', 'name start_date end_date location status')
      .populate('assignedTournaments.categories', 'name type');

    if (!umpire) {
      return res.status(404).json({
        success: false,
        message: 'Umpire not found',
        errors: [{ message: 'No umpire found with this ID' }]
      });
    }

    res.status(200).json({
      success: true,
      message: 'Umpire retrieved successfully',
      data: umpire
    });
  } catch (error) {
    console.error('Get Umpire By ID Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Create new umpire
exports.createUmpire = async (req, res) => {
  try {
    const {
      name,
      country,
      passport,
      gender,
      mobileNumber,
      QID,
    } = req.body;

    // Check for duplicate passport if provided
    if (passport) {
      const existingUmpire = await Umpire.findOne({ passport });
      if (existingUmpire) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'passport', message: 'Passport number already exists' }]
        });
      }
    }

 

    const newUmpire = new Umpire({
      name,
      country,
      passport,
      gender,
      mobileNumber: mobileNumber || [],
      QID: QID,
    });

    await newUmpire.save();

    const createdUmpire = await Umpire.findById(newUmpire._id)
      .select('-__v');

    res.status(201).json({
      success: true,
      message: 'Umpire created successfully',
      data: createdUmpire
    });

  } catch (error) {
    console.error('Create Umpire Error:', error);
    
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

// Update umpire by ID
exports.updateUmpire = async (req, res) => {
  try {
    const {
      name,
      country,
      passport,
      gender,
      mobileNumber,   
      QID,
      isActive
    } = req.body;

    const umpire = await Umpire.findById(req.params.id);

    if (!umpire) {
      return res.status(404).json({
        success: false,
        message: 'Umpire not found',
        errors: [{ message: 'No umpire found with this ID' }]
      });
    }

    // Check for duplicate passport
    if (passport && passport !== umpire.passport) {
      const existingUmpire = await Umpire.findOne({ passport, _id: { $ne: umpire._id } });
      if (existingUmpire) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'passport', message: 'Passport number already exists' }]
        });
      }
    }

   

    // Update fields
    const updateFields = {
      name, country, passport, gender, mobileNumber, 
       QID, isActive
    };

    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] !== undefined) {
        umpire[key] = updateFields[key];
      }
    });

    await umpire.save();

    const updatedUmpire = await Umpire.findById(umpire._id)
      .select('-__v');

    res.status(200).json({
      success: true,
      message: 'Umpire updated successfully',
      data: updatedUmpire
    });

  } catch (error) {
    console.error('Update Umpire Error:', error);
    
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

// Delete umpire by ID
exports.deleteUmpire = async (req, res) => {
  try {
    const umpire = await Umpire.findById(req.params.id);

    if (!umpire) {
      return res.status(404).json({
        success: false,
        message: 'Umpire not found',
        errors: [{ message: 'No umpire found with this ID' }]
      });
    }

    // Check if umpire is assigned to any active tournaments
    const activeAssignments = umpire.assignedTournaments.length > 0;
    if (activeAssignments) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete umpire',
        errors: [{ message: 'Umpire is currently assigned to tournaments. Please remove assignments first.' }]
      });
    }

    await Umpire.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Umpire deleted successfully'
    });

  } catch (error) {
    console.error('Delete Umpire Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Assign umpire to tournament
exports.assignToTournament = async (req, res) => {
  try {
    const { umpireId } = req.params;
    const { tournamentId, role, categories } = req.body;

    // Validate tournament exists
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
        errors: [{ message: 'No tournament found with this ID' }]
      });
    }

    const umpire = await Umpire.findById(umpireId);
    if (!umpire) {
      return res.status(404).json({
        success: false,
        message: 'Umpire not found',
        errors: [{ message: 'No umpire found with this ID' }]
      });
    }

    // Check if already assigned to this tournament in Umpire model
    const existingUmpireAssignment = umpire.assignedTournaments.find(
      assignment => assignment.tournament.toString() === tournamentId
    );

    // Check if already assigned to this tournament in Tournament model
    const existingTournamentAssignment = tournament.umpires.find(
      assignment => assignment.umpire.toString() === umpireId
    );

    if (existingUmpireAssignment || existingTournamentAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Assignment failed',
        errors: [{ message: 'Umpire is already assigned to this tournament' }]
      });
    }

    // Add assignment to Umpire model
    umpire.assignedTournaments.push({
      tournament: tournamentId,
      role: role || 'chair_umpire',
      categories: categories || []
    });

    // Add assignment to Tournament model
    tournament.umpires.push({
      umpire: umpireId,
      role: role || 'chair_umpire',
      categories: categories || [],
      assignedDate: new Date()
    });

    // Save both documents
    await Promise.all([
      umpire.save(),
      tournament.save()
    ]);

    const updatedUmpire = await Umpire.findById(umpireId)
      .select('-__v')
      .populate('assignedTournaments.tournament', 'name start_date end_date location')
      .populate('assignedTournaments.categories', 'name type');

    res.status(200).json({
      success: true,
      message: 'Umpire assigned to tournament successfully',
      data: updatedUmpire
    });

  } catch (error) {
    console.error('Assign Umpire Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Remove umpire from tournament
exports.removeFromTournament = async (req, res) => {
  try {
    const { umpireId, tournamentId } = req.params;

    const [umpire, tournament] = await Promise.all([
      Umpire.findById(umpireId),
      Tournament.findById(tournamentId)
    ]);

    if (!umpire) {
      return res.status(404).json({
        success: false,
        message: 'Umpire not found',
        errors: [{ message: 'No umpire found with this ID' }]
      });
    }

    // Remove assignment from Umpire model
    umpire.assignedTournaments = umpire.assignedTournaments.filter(
      assignment => assignment.tournament.toString() !== tournamentId
    );

    // Remove assignment from Tournament model
    if (tournament) {
      tournament.umpires = tournament.umpires.filter(
        assignment => assignment.umpire.toString() !== umpireId
      );
    }

    // Save both documents
    await Promise.all([
      umpire.save(),
      tournament ? tournament.save() : Promise.resolve()
    ]);

    const updatedUmpire = await Umpire.findById(umpireId)
      .select('-__v')
      .populate('assignedTournaments.tournament', 'name start_date end_date location')
      .populate('assignedTournaments.categories', 'name type');

    res.status(200).json({
      success: true,
      message: 'Umpire removed from tournament successfully',
      data: updatedUmpire
    });

  } catch (error) {
    console.error('Remove Umpire Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};

// Get umpires by tournament
exports.getUmpiresByTournament = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const umpires = await Umpire.find({
      'assignedTournaments.tournament': tournamentId
    })
    .select('name country  assignedTournaments')
    .populate('assignedTournaments.tournament', 'name start_date end_date location')
    .populate('assignedTournaments.categories', 'name type');

    // Filter to only show assignments for the specific tournament
    const formattedUmpires = umpires.map(umpire => {
      const tournamentAssignment = umpire.assignedTournaments.find(
        assignment => assignment.tournament._id.toString() === tournamentId
      );

      return {
        _id: umpire._id,
        umpireId: umpire.umpireId,
        name: umpire.name,
        country: umpire.country,
        assignment: tournamentAssignment
      };
    });

    res.status(200).json({
      success: true,
      message: 'Tournament umpires retrieved successfully',
      data: {
        tournamentId,
        umpires: formattedUmpires,
        count: formattedUmpires.length
      }
    });

  } catch (error) {
    console.error('Get Umpires By Tournament Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      errors: [{ message: error.message }]
    });
  }
};