const mongoose = require('mongoose');

const umpireSchema = new mongoose.Schema(
  {
    umpireId: {
      type: Number,
      unique: true,
      sparse: true
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      minlength: [3, 'Name must be at least 3 characters long'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    passport: {
      type: String,
      trim: true,
      sparse: true
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required']
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    mobileNumber: {
      type: [String],
      validate: {
        validator: function(v) {
          // Allow empty array or validate each number
          if (v.length === 0) return true;
          for (let num of v) {
            if (!/^[0-9]{10}$/.test(num)) return false;
          }
          return v.length <= 3; // Maximum 3 numbers
        },
        message: 'Mobile numbers must be max 3 numbers and each must be 10 digits'
      },
      default: []
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    level: {
      type: String,
      enum: ['international', 'national', 'state', 'regional'],
      default: 'regional'
    },
    certification: {
      type: String,
      trim: true
    },
    experience: {
      type: Number, // years of experience
      min: 0,
      default: 0
    },
    specialization: {
      type: [String],
      enum: ['singles', 'doubles', 'chair_umpire', 'line_umpire', 'chief_umpire'],
      default: ['singles', 'doubles']
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    assignedTournaments: [{
      tournament: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tournament'
      },
      assignedDate: {
        type: Date,
        default: Date.now
      },
      role: {
        type: String,
        enum: ['chair_umpire', 'chief_umpire', 'line_umpire', 'reserve_umpire'],
        default: 'chair_umpire'
      },
      categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      }]
    }]
  },
  { timestamps: true }
);

// Auto-increment umpireId
umpireSchema.pre('save', async function (next) {
  if (this.isNew && !this.umpireId) {
    try {
      const lastUmpire = await this.constructor.findOne({}, {}, { sort: { umpireId: -1 } });
      this.umpireId = lastUmpire ? lastUmpire.umpireId + 1 : 1;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Index for better performance
umpireSchema.index({ umpireId: 1 });
umpireSchema.index({ isActive: 1 });
umpireSchema.index({ 'assignedTournaments.tournament': 1 });

module.exports = mongoose.model('Umpire', umpireSchema);