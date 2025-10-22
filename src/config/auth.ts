import { createSigner } from "fast-jwt";
import { env } from "../common/env";

const signer = createSigner({ key: env.JWT_SECRET });
