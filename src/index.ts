import {createEventStream, eventHandler, H3, handleCors, serve} from "h3";
import {app as userHandler} from "./routes/user"
import {app as bookHandler} from "./routes/book"
import {app as eventItemHandler} from "./routes/event"
import {app as orderHandler} from "./routes/order"
import {app as authHandler} from "./routes/auth"


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
    .use(async (event, next) => {
        const corsRes = handleCors(event, {
            origin: ["http://localhost:3000"],
            credentials: true,
            preflight: {
                statusCode: 204,
            },
            methods: "*"
        });
        if (corsRes !== false) return corsRes;

        return next();
    })
    .mount("/auth", authHandler)
    .mount("/user", userHandler)
    .mount("/book", bookHandler)
    .mount("/event", eventItemHandler)
    .mount("/order", orderHandler)
    .get("/sse", eventHandler((event) => {
        const stream = createEventStream(event);

        clients.add(stream);

        stream.onClosed(() => clients.delete(stream));

        stream.push({
            event: "connected",
            data: "{}",
        }).then();

        return stream.send();
    }))

serve(app, {
    port: 3001,
});