export enum httpMessages {
  SUCCESS = "Request completed successfully.",
  NOT_FOUND = "The requested resource was not found.",

  SERVER_ERROR = "An internal server error occurred.",
  DATABASE_ERROR = "An internal database error occurred.",

  UNAUTHORIZED = "You are not authorized to access this resource.",
  BAD_REQUEST = "The request was invalid or cannot be served.",
}
