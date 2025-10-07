
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userType = req.body.userType || 'defaultUser'; 
    const fileType = req.body.fileType || 'defaultfile'; 
    if (!userType || !fileType) {
      return cb(new Error("UserType and FileType are required!"), false);
    }
    const folderPath = path.join(__dirname, "../uploads");

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });   
    }

    cb(null, folderPath); // Callback with the folder path
  },
  filename: (req, file, callback) => { 
    const filename = `image-${Date.now()}-${file.originalname}`;
    callback(null, filename);  
  }, 
});

// Filter for valid image types
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg","application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, and JPG, DOC are allowed!"), false);
  }
};

// Setup Multer with storage and filter
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5* 1024 * 1024 }, // Limit file size to 5MB
});

module.exports = upload;
 