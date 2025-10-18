const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tournament name is required'],
      trim: true
    },
    start_date: {
      type: Date,
      default: Date.now
    },
    end_date: {
      type: Date,
      default: Date.now
    },
    location: {
      type: String,
      trim: true
    },
    players: [
      {
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
          required: true
        },
        categoryName: String,
        categoryType: {
          type: String,
          enum: ['singles', 'doubles']
        },
        memberId: {
          type: String
        },
        memberIdTwo: {
          type: String
        },
        player1: {
          type: String
        },
        player2: {
          type: String
        },
        position: {
          type: Number,
          required: true
        },
        position2: {
          type: Number
        },
        user1: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        user2: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }
    ],
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    umpires: [{
      umpire: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Umpire'
      },
      role: {
        type: String,
        enum: ['chair_umpire', 'chief_umpire', 'line_umpire', 'reserve_umpire'],
        default: 'chair_umpire'
      },
      categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      }],
      assignedDate: {
        type: Date,
        default: Date.now
      }
    }],
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    originalFileName: {
      type: String,
      trim: true
    },
    fileHash: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tournament', tournamentSchema);