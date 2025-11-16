import { t } from "elysia";

export namespace SessionModel {
  export const PASSWORD_SCHEMA = t.RegExp(/^(?=.*[A-Z])(?=.*[0-9])[a-zA-Z0-9@]{6,30}$/, {
    error: "The password must be 6-30 characters long, contain at least one number, one uppercase letter, and only '@' as a special character."
  });

  export const SIGNUP_SCHEMA = t.Object({
    firstName: t.String(),
    lastName: t.String(),
    email: t.String({ format: 'email' }),
    password: PASSWORD_SCHEMA,
  });

  export const SIGNUP_STEP_2_RESPONSE = t.Void();
  export const SIGNUP_STEP_1_RESPONSE = t.Object({
    status: t.Number(),
    body: t.Object({
      message: t.Optional(t.String()),
      ok: t.Boolean(),
    }),
  });

  export const LOGIN_SCHEMA = t.Object({
    email: t.String({ format: 'email' }),
    password: t.String(),
  });
}
