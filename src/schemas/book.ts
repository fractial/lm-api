import * as v from "valibot";
import { randomUUID } from "node:crypto";
import {uuidSchema} from "./index";
import {
    type EventHandlerRequest,
    getValidatedRouterParams,
    type H3Event,
    HTTPError,
    HTTPResponse,
    readValidatedBody
} from "h3";
import {bookMap} from "../data";

export const bookSchema = v.object({
    ...uuidSchema.entries,
    title: v.pipe(
        v.string(),
        v.nonEmpty('Please enter a title.'),
        v.maxLength(256, 'The title is too long.')
    ),
    author: v.pipe(
        v.string(),
        v.nonEmpty('Please enter an author.'),
        v.maxLength(128, 'The author is too long.')
    ),

    price: v.pipe(
        v.number(),
        v.minValue(0),
        v.maxValue(9999),
    ),
    originalPrice: v.optional(
        v.pipe(
            v.number(),
            v.minValue(0),
            v.maxValue(9999),
            )
    ),

    coverImage: v.pipe(
        v.string(),
        v.nonEmpty('Please enter an url.'),
        v.url('The url is badly formatted.'),
    ),

    categories: v.array(v.string()),

    description: v.pipe(
        v.string(),
        v.nonEmpty('Please enter a description.'),
        v.maxLength(1024, 'The description is too long.')
    ),

    rating: v.optional(
        v.pipe(
            v.number(),
            v.minValue(0),
            v.maxValue(5)
        )
    ),
    reviews: v.optional(
        v.pipe(
            v.number(),
            v.minValue(0),
        )
    ),

    publishedYear: v.pipe(
        v.number(),
        v.minValue(0),
        // v.maxValue(new Date().getFullYear() + 1000),
    ),
    pages: v.pipe(
        v.number(),
        v.minValue(0)
    ),
    isbn: v.pipe(
        v.string(),
    ),
    language: v.pipe(
        v.string(),
        v.nonEmpty('Please enter a language.'),
    ),
    publisher: v.pipe(
        v.string(),
        v.nonEmpty('Please enter a language.'),
    ),
    featured: v.boolean(),
    bestseller: v.boolean(),
    newRelease: v.boolean(),
});

const { id, ...bookWithoutUuidEntries } = bookSchema.entries;

export const bookUuidSchema = v.strictObject({
    id
});

export const bookWithoutUuidSchema = v.strictObject({
    ...bookWithoutUuidEntries
});

export const partialBookWithoutUuidSchema = v.partial(bookWithoutUuidSchema);

export type Book = v.InferOutput<typeof bookSchema>;
export type BookWithoutUuid = v.InferOutput<typeof bookWithoutUuidSchema>;


export namespace Book {
    export function create(book: BookWithoutUuid): Book {
        const newBook = {
            id: randomUUID(),
            ...book
        }

        v.assert(bookSchema, newBook);

        return newBook;
    }

    export async function getAll() {
        return (await bookMap.values()).toArray();
    }

    export async function get(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);

        const book = await bookMap.get(params.id);

        if (!book) {
            throw new HTTPError({
                status: 404,
                message: 'Book not found',
            });
        }

        return book;
    }

    export async function add(event: H3Event<EventHandlerRequest>) {
        const body = await readValidatedBody(event, bookWithoutUuidSchema);

        const book = Book.create(body);
        await bookMap.add(book);

        return new HTTPResponse(JSON.stringify({
            status: 201,
            message: "Created book"
        }), { status: 201})
    }

    export async function remove(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);

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
    }

    export async function update(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);
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
    }
}