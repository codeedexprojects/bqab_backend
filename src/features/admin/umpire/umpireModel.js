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
    mobileNumber: {
      type: String,
      unique: true,
      sparse: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          const phoneRegex = /^[0-9]{10,15}$/; 
          return phoneRegex.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },
    experience: {
      type: Number, 
      min: 0,
      default: 0
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