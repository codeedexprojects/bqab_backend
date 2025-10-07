const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      minlength: [3, 'Name must be at least 3 characters long'],
    },
    qid: {
      type: String,
      required: false, 
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      required: [true, 'Club is required'],
      validate: {
        validator: async function (clubId) {
          const club = await mongoose.model('Club').findById(clubId);
          return club !== null;
        },
        message: 'Invalid club ID. Club does not exist.'
      }
    },
    country: {
      type: String,
      required: false,
    },
    dob: {
      type: Date,
      required: false,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: false,
    },
    mobile: {
      type: String,
      unique: true,
      sparse: true,
      validate: {
        validator: function (v) {
          const phoneRegex = /^[0-9]{10,15}$/; 
          return phoneRegex.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },
    level: {
      type: String,
      enum: ['a', 'b', 'c', 'd', 'e', 'open'],
      required: false,
    },

    role: { type: String, default: 'customer' },
 
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  { timestamps: true }
);



module.exports = mongoose.model('User', userSchema);