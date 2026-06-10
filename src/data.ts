import {NonObjectQueueMap, ObjectQueueMap} from "./data/collection";
import type {Book, User} from "./schemas";
import * as path from "node:path";

// @ts-ignore
const ROOT_PATH = path.join(import.meta.dirname, "..", "srv")

export const userMap = await new ObjectQueueMap(
    path.join(ROOT_PATH, "users.json"),
    (user: User) => user.id
).load();

export const mailMap = await new NonObjectQueueMap<User["email"], User["id"]>(
    path.join(ROOT_PATH, "mails.json")
).load();

export const bookMap = await new ObjectQueueMap(
    path.join(ROOT_PATH, "books.json"), (book: Book) => book.id
).load();

export const EventMap = await new NonObjectQueueMap<User["email"], User["id"]>(
    "events.json"
).load();

export const OrderMap = await new NonObjectQueueMap<User["email"], User["id"]>(
    "orders.json"
).load();