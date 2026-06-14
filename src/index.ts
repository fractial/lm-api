import {createEventStream, eventHandler, H3, handleCors, serve, serveStatic} from "h3";
import {app as userHandler} from "./routes/user"
import {app as bookHandler} from "./routes/book"
import {app as eventItemHandler} from "./routes/event"
import {app as orderHandler} from "./routes/order"
import {app as authHandler} from "./routes/auth"
import {app as imageHandler} from "./routes/image"
import * as console from "node:console";
import {readFile, stat} from "node:fs/promises";
import {join} from "node:path";


const clients = new Set<Awaited<ReturnType<typeof createEventStream>>>()

export function broadcastEvent<T>(event: string, data: T) {
    for (const client of clients) {
        console.log("BROADCAST:", event, data)
        client.push({
            event,
            data: JSON.stringify(data),
        });
    }
}

const app = new H3()
    .use("/public/**", (event) => {
        return serveStatic(event, {
            getContents: (id) => readFile(join("public", id.replace(/^\/?public\//, ""))),
            getMeta: async (id) => {
                const stats = await stat(join("public", id.replace(/^\/?public\//, ""))).catch(() => {});
                if (stats?.isFile()) {
                    return {
                        size: stats.size,
                        mtime: stats.mtimeMs,
                    };
                }
            },
        });
    })
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
    .mount("/image", imageHandler)
    .get("/sse", eventHandler((event) => {
        const stream = createEventStream(event);

        clients.add(stream);

        stream.onClosed(() => clients.delete(stream));

        stream.push({
            event: "connected",
            data: "{}",
        });

        return stream.send();
    }))

serve(app, {
    port: 3001,
});