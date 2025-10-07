const sendResponse = (res, statusCode, message, data = undefined) => {
    res.status(statusCode).json({
      success: statusCode < 400,
      message,
      data,
    });
  };
  
  module.exports = { sendResponse };