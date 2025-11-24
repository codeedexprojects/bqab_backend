const multer = require("multer");
const path = require("path");

const excelFileFilter = (req, file, cb) => {
  const allowed = [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet"
  ];
  
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only Excel files are allowed. Received: ${file.mimetype}`), false);
  }
};

const uploadExcel = multer({
  storage: multer.memoryStorage(), 
  fileFilter: excelFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, 
});

module.exports = uploadExcel;