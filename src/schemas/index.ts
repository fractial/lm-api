import * as v from "valibot";

export const uuidSchema = v.strictObject({
    id: v.pipe(
        v.string(),
        v.uuid('The uuid is badly formatted.'))
});