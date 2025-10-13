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

    cb(null, folderPath);
  },
  filename: (req, file, callback) => {
    const filename = `file-${Date.now()}-${file.originalname}`;
    callback(null, filename);
  },
});

// Filter for valid file types
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    // Images
    "image/jpeg",
    "image/png",
    "image/jpg",

    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    // Excel files
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, JPG, PDF, DOC, DOCX, XLS, and XLSX are allowed!"
      ),
      false
    );
  }
};

// Setup Multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = upload;
