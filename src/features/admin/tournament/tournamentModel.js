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
        memberId: String,
        memberIdTwo: String,
        player1: String,
        player2: String,
        position: {
          type: Number,
          required: true
        },
        position2: Number,
        user1: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        user2: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        pointsEarned: Number, 
        pointsEarnedUser1: Number,
        pointsEarnedUser2: Number
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
    originalFileName: String,
    fileHash: {
      type: String,
      unique: true,
      sparse: true
    },
    // Tournament rankings cache
    categoryRankings: [{
      category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      },
      categoryName: String,
      rankings: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        qid: String,
        name: String,
        points: Number,
        position: Number
      }]
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tournament', tournamentSchema);