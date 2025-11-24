const multer = require("multer");
const path = require("path");
const fs = require("fs");
// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/temp");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname +
        "-" +
        uniqueSuffix +
        path.extname(file.originalname)
    );
  },
});

const excelFileFilter = (req, file, cb) => {
  const allowed = [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Only Excel files are allowed. Received: ${file.mimetype}`
      ),
      false
    );
  }
};

const uploadExcel = multer({
  storage: storage, // Use disk storage instead of memory storage
  fileFilter: excelFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = uploadExcel;