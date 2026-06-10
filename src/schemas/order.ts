import * as v from "valibot";
import { randomUUID } from "node:crypto";
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
    createdBy: v.optional(v.string()),
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
    export async function create(order: OrderCreate): Promise<Order> {
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

            return sum + product.price * orderItem.quantity;
        }, Promise.resolve(0));

        const newOrder = {
            ...order,
            id: randomUUID(),
            total: await totalPrice,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        v.assert(orderSchema, newOrder);

        return newOrder;
    }

    export async function getAll() {
        return (await orderMap.values()).toArray();
    }

    export async function get(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);

        const order = await orderMap.get(params.id);

        if (!order) {
            throw new HTTPError({
                status: 404,
                message: 'Order not found',
            });
        }

        return order;
    }

    export async function add(event: H3Event<EventHandlerRequest>) {
        const body = await readValidatedBody(event, orderCreateSchema);

        const order = await Order.create(body);
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