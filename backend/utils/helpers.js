// Format success response
export const successResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data,
  };
};

// Format error response
export const errorResponse = (message, code = 'ERROR', details = {}) => {
  return {
    success: false,
    error: {
      message,
      code,
      details,
    },
  };
};
