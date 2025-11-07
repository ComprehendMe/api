import { t } from "elysia";
import Type from "typebox";

export namespace SessionModel {
  export const PASSWORD_SCHEMA = Type.Refine(
    t.String({ minLength: 6, maxLengt2h: 30 }),
    (value) => {
      const hasNumber = /\d/.test(value);
      const hasUppercase = /[A-Z]/.test(value);
      const onlyAllowedChars = /^[a-zA-Z0-9@]*$/.test(value);
      return hasNumber && hasUppercase && onlyAllowedChars;
    },
    "The password must contain at least one number, one uppercase letter, and only '@' as a special character."
  );

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
