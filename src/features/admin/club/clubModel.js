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
      validate: {
        validator: function(v) {
          if (v.length > 3) return false;
          for (let num of v) {
            if (!/^[0-9]{10}$/.test(num)) return false;
          }
          return true;
        },
        message: 'Mobile numbers must be max 3 numbers and each must be 10 digits'
      },
      default: []
    },
    address: {
      street: { type: String, trim: true, maxlength: [200, 'Street address cannot exceed 200 characters'] },
      city: { type: String, trim: true, maxlength: [50, 'City cannot exceed 50 characters'] },
      state: { type: String, trim: true, maxlength: [50, 'State cannot exceed 50 characters'] },
      zipCode: {
        type: String,
        trim: true,
        validate: {
          validator: function(v) {
            return !v || /^[0-9]{5,6}$/.test(v);
          },
          message: 'Zip code must be 5-6 digits'
        }
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