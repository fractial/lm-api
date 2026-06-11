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
import {eventMap} from "../data";

export const eventSchema = v.strictObject({
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
    date: v.pipe(
        v.string(),
        v.isoTimestamp()
    ),
    location: v.pipe(
        v.string(),
        v.nonEmpty('Please enter a location name.'),
        v.maxLength(128, 'The location name is too long.')
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
    availableSeats: v.pipe(
        v.number(),
        v.minValue(0)
    ),
    totalSeats: v.pipe(
        v.number(),
        v.minValue(1)
    ),
    categories: v.array(v.string()),
    description: v.pipe(
        v.string(),
        v.nonEmpty('Please enter a description.'),
        v.maxLength(1024, 'The description is too long.')
    ),
    language: v.pipe(
        v.string(),
        v.nonEmpty('Please enter a language.'),
    ),
});

const { id, ...eventWithoutUuidEntries } = eventSchema.entries;

export const eventUuidSchema = v.strictObject({
    id
});

export const eventWithoutUuidSchema = v.strictObject({
    ...eventWithoutUuidEntries
});

export const partialEventWithoutUuidSchema = v.partial(eventWithoutUuidSchema);

export type Event = v.InferOutput<typeof eventSchema>;
export type EventWithoutUuid = v.InferOutput<typeof eventWithoutUuidSchema>;


export namespace Event {
    export function create(event: EventWithoutUuid): Event {
        const newEvent = {
            id: randomUUID(),
            ...event
        }

        v.assert(eventSchema, newEvent);

        return newEvent;
    }

    export async function getAll() {
        return (await eventMap.values()).toArray();
    }

    export async function get(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);

        const eventItem = await eventMap.get(params.id);

        if (!eventItem) {
            throw new HTTPError({
                status: 404,
                message: 'Event not found',
            });
        }

        return eventItem;
    }

    export async function add(event: H3Event<EventHandlerRequest>) {
        const body = await readValidatedBody(event, eventWithoutUuidSchema);

        const eventItem = Event.create(body);
        await eventMap.add(eventItem);

        return new HTTPResponse(JSON.stringify({
            status: 201,
            message: "Created event"
        }), { status: 201})
    }

    export async function remove(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);

        const eventItem = await eventMap.delete(params.id);

        if (!eventItem) {
            throw new HTTPError({
                status: 404,
                message: 'Event not found',
            });
        }

        return new HTTPResponse(JSON.stringify({
            status: 200,
            message: "Deleted event"
        }))
    }

    export async function update(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);
        const body = await readValidatedBody(event, partialEventWithoutUuidSchema);

        await eventMap.withLock(async ({ map, save }) => {
            const eventItem = map.get(params.id);

            if (!eventItem) {
                throw new HTTPError({
                    status: 404,
                    message: 'Event not found',
                });
            }

            const updatedEvent = {
                ...eventItem,
                ...Object.fromEntries(
                    Object.entries(body).filter(([, value]) => value !== undefined),
                )
            } satisfies Event;

            map.set(params.id, updatedEvent);

            await save()
        })

        return new HTTPResponse(JSON.stringify({
            status: 200,
            message: "Updated event"
        }))
    }
}