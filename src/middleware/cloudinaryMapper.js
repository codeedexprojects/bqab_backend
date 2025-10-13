
// Middleware to map Cloudinary files into req.body.images
module.exports = (req, res, next) => {
  if (req.files && req.files.length > 0) {
    req.body.images = req.files.map((file) => ({
      url: file.path,       // ✅ Cloudinary URL
      public_id: file.filename,
    }));
  }

  if (req.file) {
    req.body.image = {
      url: req.file.path,
      public_id: req.file.filename,
    };
  }

  next();
};