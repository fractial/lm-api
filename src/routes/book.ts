import {getValidatedRouterParams, HTTPResponse, H3, HTTPError, readValidatedBody} from "h3";
import {bookMap} from "../data";
import * as v from "valibot";
import {Book, bookSchema, bookUuidSchema, bookWithoutUuidSchema, partialBookWithoutUuidSchema} from "../schemas";

export const app: H3 = new H3()
    .get('/', async () => {
        return (await bookMap.values()).toArray();
    })
    .get('/:id', async (event) => {
        const params = await getValidatedRouterParams(event, bookUuidSchema);

        const book = await bookMap.get(params.id);

        if (!book) {
            throw new HTTPError({
                status: 404,
                message: 'Book not found',
            });
        }

        return book;
    })
    .post('/', async (event) => {
        const body = await readValidatedBody(event, bookWithoutUuidSchema);

        const book = Book.create(body);
        await bookMap.add(book);

        return new HTTPResponse(JSON.stringify({
            status: 201,
            message: "Created book"
        }), { status: 201})
    })
    .delete('/:id', async (event) => {
        const params = await getValidatedRouterParams(event, bookUuidSchema);

        const book = await bookMap.delete(params.id);

        if (!book) {
            throw new HTTPError({
                status: 404,
                message: 'Book not found',
            });
        }

        return new HTTPResponse(JSON.stringify({
            status: 200,
            message: "Deleted book"
        }))
    })
    .patch('/:id', async (event) => {
        const params = await getValidatedRouterParams(event, bookUuidSchema);
        const body = await readValidatedBody(event, partialBookWithoutUuidSchema);

        await bookMap.withLock(async ({ map, save }) => {
            const book = map.get(params.id);

            if (!book) {
                throw new HTTPError({
                    status: 404,
                    message: 'Book not found',
                });
            }

            const updatedBook = {
                ...book,
                ...Object.fromEntries(
                    Object.entries(body).filter(([, value]) => value !== undefined),
                )
            } satisfies Book;

            map.set(params.id, updatedBook);

            await save()
        })

        return new HTTPResponse(JSON.stringify({
            status: 200,
            message: "Updated book"
        }))
    });