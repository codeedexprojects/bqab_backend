module.exports = (req, res, next) => {
  try {
    if (req.files?.length > 0) {
      req.body.images = req.files.map((file) => ({
        url: file.path,
        public_id: file.filename,
      }));
    }

    if (req.file) {
      req.body.image = req.file.path;
    }

    next();
  } catch (error) {
    next(error);
  }
};
