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
      trim: true,
    },
    logo: {
      type: String,
      default: null,
      trim: true,
    },
    mobileNumbers: {
      type: [String],
      default: []
    },
    address: {
      street: { type: String, trim: true, maxlength: [200, 'Street address cannot exceed 200 characters'] },
      city: { type: String, trim: true, maxlength: [50, 'City cannot exceed 50 characters'] },
      state: { type: String, trim: true, maxlength: [50, 'State cannot exceed 50 characters'] },
      zipCode: {
        type: String,
        trim: true,
      },
      country: { type: String, trim: true, default: 'India', maxlength: [50, 'Country cannot exceed 50 characters'] }
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