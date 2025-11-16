import { status as genStatus, type StatusMap } from 'elysia';

export enum http {
  Success = 1000,
  Created = 1001,
  BadRequest = 2000,
  Unauthorized = 2001,
  NotFound = 2002,
  InternalServerError = 3000,
  InternalDatabaseError = 3001
}

export const httpCodes: Record<http, number> = {
  [http.Success]: 200,
  [http.Created]: 201,
  [http.BadRequest]: 400,
  [http.Unauthorized]: 401,
  [http.NotFound]: 404,
  [http.InternalDatabaseError]: 500,
  [http.InternalServerError]: 500,
}

export const httpCodeToText: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  500: 'Internal Server Error'
}

export const httpMessages: Record<http, string> = {
  [http.Success]: "Request completed successfully.",
  [http.Created]: "",
  [http.NotFound]: "The requested resource was not found.",

  [http.InternalServerError]: "An internal server error occurred.",
  [http.InternalDatabaseError]: "An internal database error occurred.",

  [http.Unauthorized]: "You are not authorized to access this resource.",
  [http.BadRequest]: "The request was invalid or cannot be served.",
}

export const exception = (
  status: number,
  code: http,
  errors?: unknown,
) => genStatus(httpCodeToText[status], { code, errors, message: httpMessages[code] });