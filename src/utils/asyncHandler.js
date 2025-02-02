import STATUS_CODES from '../utils/StatusCode.js';

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    const statusCode = error.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
    next(error);
  }
};

export { asyncHandler };
