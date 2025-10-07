const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema(
  {
    clubId: {
      type: Number,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      minlength: [3, 'Name must be at least 3 characters long'],
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  { timestamps: true }
);

// Auto-increment clubId
clubSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const lastClub = await this.constructor.findOne({}, {}, { sort: { clubId: -1 } });
      this.clubId = lastClub ? lastClub.clubId + 1 : 1;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Club', clubSchema);