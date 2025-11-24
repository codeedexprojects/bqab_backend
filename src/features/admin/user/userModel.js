const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(v);
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    image: {
      type: String,
    },
    qid: {
      type: String,
      required: false,
      trim: true,
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: false,
    },
    country: {
      type: String,
      required: false,
    },
    dob: {
      type: Date,
      required: false,
    },
    passport: {
      type: String,
      required: false,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: false,
    },
    mobile: {
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
    level: {
      type: String,
      enum: ["a", "b", "c", "d", "e", "open"],
      required: false,
    },
    points: {
      type: Number,
      default: 0,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    categoryPoints: [
      {
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
        categoryName: String,
        categoryType: String,
        points: {
          type: Number,
          default: 0,
        },
        tournamentsCount: {
          type: Number,
          default: 0,
        },
        lastUpdated: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    pointsHistory: [
      {
        tournament: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Tournament",
          required: true,
        },
        tournamentName: String,
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
        categoryName: String,
        categoryType: String,
        pointsEarned: {
          type: Number,
          required: true,
        },
        position: Number,
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    role: {
      type: String,
      default: "customer",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
userSchema.index({ "categoryPoints.category": 1 });
userSchema.index({ totalPoints: -1 });
userSchema.index({ email: 1 }, { sparse: true });

module.exports = mongoose.model("User", userSchema);
