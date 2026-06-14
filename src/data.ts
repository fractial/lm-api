import {NonObjectQueueMap, ObjectQueueMap} from "./data/collection";
import type {Book} from "./schemas/book";
import type {Event} from "./schemas/event";

import * as path from "node:path";
import type {User} from "./schemas/user";
import type {Order} from "./schemas/order";

// @ts-ignore
const ROOT_PATH = path.join(import.meta.dirname, "..", "srv")

// Users

class UserMap extends ObjectQueueMap<User["id"], User> {
    protected key(value: User): string {
        return value.id;
    }
}

export const userMap: ObjectQueueMap<User["id"], User> = await new UserMap(
    path.join(ROOT_PATH, "users.json")
).load();

export const mailMap = await new NonObjectQueueMap<User["email"], User["id"]>(
    path.join(ROOT_PATH, "mails.json")
).load();

// Books

class BookMap extends ObjectQueueMap<Book["id"], Book> {
    protected key(value: Book): string {
        return value.id;
    }
}

export const bookMap: ObjectQueueMap<Book["id"], Book> = await new BookMap(
    path.join(ROOT_PATH, "books.json")
).load();

// Books

class EventMap extends ObjectQueueMap<Event["id"], Event> {
    protected key(value: Event): string {
        return value.id;
    }
}

export const eventMap: ObjectQueueMap<Event["id"], Event> = await new EventMap(
    path.join(ROOT_PATH, "events.json")
).load();

// Orders

class OrderMap extends ObjectQueueMap<Order["id"], Order> {
    protected key(value: Order): string {
        return value.id;
    }
}

export const orderMap: ObjectQueueMap<Order["id"], Order> = await new OrderMap(
    path.join(ROOT_PATH, "orders.json")
).load();

export const productArray: ObjectQueueMap<string, { title: string, price: number }>[] = [
    bookMap,
    eventMap
] as const;