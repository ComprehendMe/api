import { status as genStatus, type StatusMap } from 'elysia';

export enum http {
  Success = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  NotFound = 404,
  InternalServerError = 500,
  InternalDatabaseError = 500
}

export const httpMessages: Map<http, string> = {
  [http.Success]: "Request completed successfully.",
  [http.NotFound]: "The requested resource was not found.",

  [http.InternalServerError]: "An internal server error occurred.",
  [http.InternalDatabaseError]: "An internal database error occurred.",

  [http.Unauthorized]: "You are not authorized to access this resource.",
  [http.BadRequest]: "The request was invalid or cannot be served.",
}

export const exception = (
  status: keyof StatusMap,
  code: http,
  errors?: unknown,
) => genStatus(status, { code, errors, message: httpMessages[code] });

