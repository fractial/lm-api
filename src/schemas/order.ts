import * as v from "valibot";
import {randomUUID} from "node:crypto";
import {uuidSchema} from "./index";
import {orderMap, productArray} from "../data";
import {
    type EventHandlerRequest,
    getValidatedRouterParams,
    type H3Event,
    HTTPError,
    HTTPResponse,
    readValidatedBody
} from "h3";
import {userAddressSchema} from "./user";
import {bookSchema} from "./book";

export const orderCreateSchema = v.object({
    items: v.array(v.object({
        ...uuidSchema.entries,
        quantity: v.pipe(v.number(), v.minValue(0))
    })),
    paymentMethod: v.union([v.literal("card"), v.literal("invoice")]),
    shippingAddress: v.object({
        name: v.pipe(
            v.string(),
            v.nonEmpty('Please enter a name.'),
            v.maxLength(128, 'The name is too long.')
        ),
        ...userAddressSchema.entries,
    })
})

const orderPatchSchema = v.object({
    ...orderCreateSchema.entries,
    status: v.pipe(
        v.string(),
        v.nonEmpty(),
    ),
})

export const partialOrderPatchSchema = v.partial(orderPatchSchema);

export const orderSchema = v.object({
    ...uuidSchema.entries,
    ...orderCreateSchema.entries,
    ...orderPatchSchema.entries,
    total: v.pipe(
        v.number(),
        v.minValue(0),
    ),
    items: v.array(v.object({
        ...uuidSchema.entries,
        title: bookSchema.entries.title,
        price: bookSchema.entries.price,
        quantity: v.pipe(v.number(), v.minValue(0))
    })),
    createdBy: v.pipe(
        v.string(),
        v.uuid(),
    ),
    createdAt: v.date(),
    updatedAt: v.date(),
});

const { id, ...orderWithoutUuidEntries } = orderSchema.entries;

export const orderWithoutUuidSchema = v.strictObject({
    ...orderWithoutUuidEntries
});

export type Order = v.InferOutput<typeof orderSchema>;
export type OrderCreate = v.InferOutput<typeof orderCreateSchema>;

export namespace Order {
    export async function create(order: OrderCreate, userId: string): Promise<Order> {
        const resolvedMaps = await Promise.all(productArray);

        const totalPrice = order.items.reduce(async (sumPromise, orderItem) => {
            const sum = await sumPromise;
            let product = undefined;

            for (const map of resolvedMaps) {
                product = await map.get(orderItem.id);
                if (product) break;
            }

            if (!product) {
                throw new HTTPError(`Product not found: ${orderItem.id}`);
            }

            return Number((sum + product.price * orderItem.quantity).toFixed(2));
        }, Promise.resolve(0));

        const newOrder = {
            ...order,
            items: await Promise.all(order.items.map(async item => {
                let product;

                for (const map of resolvedMaps) {
                    product = await map.get(item.id);
                    if (product) break;
                }

                return {
                    title: product?.title ?? "Unknown",
                    price: product?.price ?? 0,
                    quantity: item.quantity,
                    id: item.id,
                } satisfies Order["items"][number];
            })),
            id: randomUUID(),
            total: await totalPrice,
            status: "pending",
            createdBy: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        v.assert(orderSchema, newOrder);

        return newOrder;
    }

    export async function getAll(event: H3Event<EventHandlerRequest>) {
        const {user: jwtUser} = event.context.jwtAuth!;
        const orders = (await orderMap.values()).toArray();

        if (!jwtUser.isAdmin) {
            return orders.filter(order => order.createdBy === jwtUser.id);
        }

        return orders;
    }

    export async function get(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);

        const {user: jwtUser} = event.context.jwtAuth!;

        const order = await orderMap.get(params.id);

        if (!order) {
            throw new HTTPError({
                status: 404,
                message: 'Order not found',
            });
        }

        if (!jwtUser.isAdmin || order.createdBy !== jwtUser.id) {
            throw new HTTPError({
                status: 403,
                message: 'Forbidden',
            });
        }

        return order;
    }

    export async function add(event: H3Event<EventHandlerRequest>) {
        const body = await readValidatedBody(event, orderCreateSchema);

        const {user: jwtUser} = event.context.jwtAuth!;

        if (!jwtUser.isAdmin || !jwtUser) {
            throw new HTTPError({
                status: 403,
                message: 'Forbidden',
            });
        }

        const order = await Order.create(body, jwtUser.id);
        await orderMap.add(order);

        return new HTTPResponse(JSON.stringify({
            status: 201,
            message: "Created order"
        }), { status: 201})
    }

    export async function remove(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);

        const order = await orderMap.delete(params.id);

        if (!order) {
            throw new HTTPError({
                status: 404,
                message: 'Order not found',
            });
        }

        return new HTTPResponse(JSON.stringify({
            status: 200,
            message: "Deleted order"
        }))
    }

    export async function update(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);
        const body = await readValidatedBody(event, partialOrderPatchSchema);

        await orderMap.withLock(async ({ map, save }) => {
            const order = map.get(params.id);

            if (!order) {
                throw new HTTPError({
                    status: 404,
                    message: 'Order not found',
                });
            }

            const updatedOrder = {
                ...order,
                ...Object.fromEntries(
                    Object.entries(body).filter(([, value]) => value !== undefined),
                ),
                updatedAt: new Date(),
            } satisfies Order;

            map.set(params.id, updatedOrder);

            await save()
        })

        return new HTTPResponse(JSON.stringify({
            status: 200,
            message: "Updated order"
        }))
    }
}