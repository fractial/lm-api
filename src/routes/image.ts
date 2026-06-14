import {
    H3,
    readBody,
    getRouterParam,
    HTTPError, readRawBody,
} from "h3";

import { readFile, stat, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

export const app: H3 = new H3()
    .post("/:id", async (event) => {
        const id = getRouterParam(event, "id");

        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
            throw new HTTPError({
                statusCode: 400,
                statusMessage: "Invalid image id",
            });
        }

        const image = await readRawBody(event, false);

        if (!image) {
            throw new HTTPError({
                statusCode: 400,
                statusMessage: "Missing image data",
            });
        }

        await writeFile(
            join("public", `${id}.png`),
            Buffer.from(image)
        );

        return {
            success: true,
            path: `/public/${id}.png`,
        };
    })
    .delete("/:id", async (event) => {
            const id = getRouterParam(event, "id");

            if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
                throw new HTTPError({
                    statusCode: 400,
                    statusMessage: "Invalid image id",
                });
            }

            try {
                await unlink(join("public", `${id}.png`));

                return {
                    success: true,
                };
            } catch {
                throw new HTTPError({
                    statusCode: 404,
                    statusMessage: "Image not found",
                });
            }
    })