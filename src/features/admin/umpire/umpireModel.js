const mongoose = require("mongoose");

const umpireSchema = new mongoose.Schema(
  {
    umpireId: {
      type: Number,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      minlength: [3, "Name must be at least 3 characters long"],
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },
    passport: {
      type: String,
      trim: true,
      sparse: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: [true, "Gender is required"],
    },
    mobileNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    QID: {
      type: String,
      unique: true,
      trim: true,
      sparse: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    assignedTournaments: [
      {
        tournament: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Tournament",
        },
        assignedDate: {
          type: Date,
          default: Date.now,
        },
        role: {
          type: String,
          default: "chair_umpire",
        },
        categories: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

// Auto-increment umpireId
umpireSchema.pre("save", async function (next) {
  if (this.isNew && !this.umpireId) {
    try {
      const lastUmpire = await this.constructor.findOne(
        {},
        {},
        { sort: { umpireId: -1 } }
      );
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
umpireSchema.index({ "assignedTournaments.tournament": 1 });

module.exports = mongoose.model("Umpire", umpireSchema);
