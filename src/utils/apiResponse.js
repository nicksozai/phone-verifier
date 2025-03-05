// Success response
const success = (res, data, statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      data
    });
  };
  
  // Error response
  const error = (res, message, statusCode = 400) => {
    res.status(statusCode).json({
      success: false,
      error: message
    });
  };
  
  module.exports = { success, error };