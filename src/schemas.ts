import * as v from "valibot";
import { randomUUID } from "node:crypto";

export const UserSchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    email: v.pipe(v.string(), v.email()),
    password: v.pipe(v.string(), v.minLength(8))
})

export type User = v.InferOutput<typeof UserSchema>;

export namespace User {
    export async function create(user: Omit<User, "id">): Promise<User> {
        return {
            id: randomUUID(),
            ...user,
        };
    }
}

export const bookSchema = v.object({
    id: v.pipe(
        v.string(),
        v.uuid('The uuid is badly formatted.')),
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

export namespace Book {
    export function create(book: Omit<Book, "id">): Book {
        const newBook = {
            id: randomUUID(),
            ...book
        }

        v.assert(bookSchema, newBook);

        return newBook;
    }
}