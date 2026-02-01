import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ChannelConfigSchema } from "./types.plugin.js";

export function buildChannelConfigSchema(schema: ZodTypeAny): ChannelConfigSchema {
  return {
    schema: zodToJsonSchema(schema, {
      target: "jsonSchema7",
    }) as Record<string, unknown>,
  };
}
