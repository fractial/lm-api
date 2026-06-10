import {createEventStream, eventHandler, H3, serve} from "h3";
import {app as userHandler} from "./routes/user"
import {app as bookHandler} from "./routes/book"
import {app as orderHandler} from "./routes/order"

const clients = new Set<Awaited<ReturnType<typeof createEventStream>>>()

export function broadcastEvent<T>(event: string, data: T) {
    for (const client of clients) {
        client.push({
            event,
            data: JSON.stringify(data),
        }).then();
    }
}

const app = new H3()
    .mount("/user", userHandler)
    .mount("/book", bookHandler)
    .mount("/order", orderHandler)
    .get("/event", eventHandler((event) => {
        const stream = createEventStream(event);

        clients.add(stream);

        stream.onClosed(() => clients.delete(stream));

        stream.push({
            event: "connected",
            data: "{}",
        }).then();

        return stream.send();
    }))

serve(app);