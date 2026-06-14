import * as v from "valibot";
import {randomUUID} from "node:crypto";
import {hash} from "argon2";
import {uuidSchema} from "./index";
import {mailMap, userMap} from "../data";
import {
    H3Event,
    type EventHandlerRequest,
    HTTPError,
    getValidatedRouterParams,
    HTTPResponse,
    readValidatedBody
} from "h3";
import * as console from "node:console";
import {broadcastEvent} from "../index";
import {useJWSSession} from "unjwt/adapters/h3v2";
import {jwsOptions} from "./auth";
import {includes} from "valibot";

export const userGetSchema = v.strictObject({
    id: v.union([
        v.pipe(v.string(), v.uuid()),
        v.pipe(v.string(), v.email()),
    ])
});

export const userAddressSchema =
        v.object({
            street: v.pipe(
                v.string(),
                v.nonEmpty('Please enter a street name.'),
                v.maxLength(128, 'The street name is too long.')
            ),
            city: v.pipe(
                v.string(),
                v.nonEmpty('Please enter a city name.'),
                v.maxLength(128, 'The city name is too long.')
            ),
            zip: v.pipe(
                v.string(),
                v.nonEmpty('Please enter a zip code.'),
                v.maxLength(128, 'The zip code is too long.')
            ),
            country: v.pipe(
                v.string(),
                v.nonEmpty('Please enter a country name.'),
                v.maxLength(128, 'The country name is too long.')
            ),
        });

export const userRegisterSchema = v.strictObject({
    email: v.pipe(v.string(), v.email()),
    password: v.pipe(v.string(), v.minLength(8)),
    name: v.pipe(
        v.string(),
        v.nonEmpty('Please enter a name.'),
        v.maxLength(128, 'The name is too long.')
    ),
    address: v.optional(userAddressSchema),
});

export const adminUserRegisterSchema = v.strictObject({
    ...userRegisterSchema.entries,
    orderCount: v.pipe(
        v.number(),
        v.minValue(0)
    ),
    canPayOnInvoice: v.boolean(),
    isAdmin: v.boolean(),
});

export const userWithoutUuidSchema = v.object({
    ...userRegisterSchema.entries,
    orderCount: v.pipe(
        v.number(),
        v.minValue(0)
    ),
    canPayOnInvoice: v.boolean(),
    isAdmin: v.boolean(),
    createdAt: v.date(),
    updatedAt: v.date(),
})

export const partialUserWithoutUuidSchema = v.partial(userWithoutUuidSchema);

export const userSchema = v.object({
    ...uuidSchema.entries,
    ...userWithoutUuidSchema.entries,
})

export const partialUserRegisterSchema = v.partial(userRegisterSchema);

export type UserRegister = v.InferOutput<typeof userRegisterSchema>;
export type User = v.InferOutput<typeof userSchema>;

export namespace User {
    export async function create(user: UserRegister): Promise<User> {
        const newUser = {
            id: randomUUID(),
            orderCount: 0,
            canPayOnInvoice: false,
            isAdmin: false,
            ...user,
            createdAt: new Date(),
            updatedAt: new Date(),
            password: await hash(user.password),
        }

        v.assert(userSchema, newUser);

        return newUser;
    }

    export async function getAll() {
        return (await userMap.values()).toArray().map(({ password, ...user }) => user);
    }

    export async function get(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, userGetSchema);
        const key = params.id;

        const {accessSession, user: jwtUser} = event.context.jwtAuth!;

        console.log(jwtUser.id, accessSession.data.sub, params.id, jwtUser?.isAdmin);

        if (!jwtUser.isAdmin && params.id !== accessSession.data.sub) {
            throw new HTTPError({
                status: 403,
                message: 'Forbidden',
            });
        }

        const isUuid = v.safeParse(v.pipe(v.string(), v.uuid()), params.id).success;
        const isEmail = v.safeParse(v.pipe(v.string(), v.email()), params.id).success;

        let user: User | undefined;

        if (v.safeParse(v.pipe(v.string(), v.uuid()), key).success) {
            user = await userMap.get(key);
        } else if (v.safeParse(v.pipe(v.string(), v.email()), key).success) {
            const id = await mailMap.get(key);
            if (id) {
                user = await userMap.get(id);
            }
        }

        if (!user) {
            throw new HTTPError({
                status: 404,
                message: 'User not found',
            });
        }

        const { password, ...safeUser } = user;

        return safeUser;
    }

    export async function add(event: H3Event<EventHandlerRequest>) {
        const accessSession = await useJWSSession(event, jwsOptions);

        let body;

        if ((accessSession.data["scope"] as string[])?.includes("admin")) {
            body = await readValidatedBody(event, adminUserRegisterSchema);
        } else {
            body = await readValidatedBody(event, userRegisterSchema);
        }

        if (await mailMap.has(body.email)) {
            throw new HTTPError({
                status: 400,
                message: 'Email already in use',
            });
        }

        const user = await User.create(body);
        await mailMap.set(user.email, user.id);
        await userMap.add(user);

        broadcastEvent("users-updated", {})

        return new HTTPResponse(JSON.stringify({
            status: 201,
            message: "Created user"
        }), { status: 201})
    }

    export async function remove(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);

        const {accessSession, user: jwtUser} = event.context.jwtAuth!;

        if (!jwtUser.isAdmin && params.id !== accessSession.data.sub) {
            throw new HTTPError({
                status: 403,
                message: 'Forbidden',
            });
        }

        const user = await userMap.get(params.id);

        if (!user) {
            throw new HTTPError({
                status: 404,
                message: 'User not found',
            });
        }

        await mailMap.delete(user.email);
        await userMap.delete(params.id);

        broadcastEvent("users-updated", {})

        return new HTTPResponse(JSON.stringify({
            status: 200,
            message: "Deleted user"
        }))
    }

    export async function update(event: H3Event<EventHandlerRequest>) {
        const params = await getValidatedRouterParams(event, uuidSchema);

        const {accessSession, user} = event.context.jwtAuth!;

        if (!user.isAdmin && params.id !== accessSession.data.sub) {
            throw new HTTPError({
                status: 403,
                message: 'Forbidden',
            });
        }

        let body;

        if (user.isAdmin) {
            body = await readValidatedBody(event, partialUserWithoutUuidSchema);
        } else {
            body = await readValidatedBody(event, partialUserRegisterSchema);
        }

        await userMap.withLock(async ({ map, save }) => {
            const user = map.get(params.id);

            if (!user) {
                throw new HTTPError({
                    status: 404,
                    message: 'User not found',
                });
            }

            const updatedUser = {
                ...user,
                ...Object.fromEntries(
                    Object.entries(body).filter(([, value]) => value !== undefined),
                ),
                updatedAt: new Date(),
            } satisfies User;

            if (updatedUser.email !== user.email) {
                if (await mailMap.has(updatedUser.email)) {
                    throw new HTTPError({
                        status: 400,
                        message: 'Email already in use',
                    });
                }

                await mailMap.delete(user.email);
                await mailMap.set(updatedUser.email, params.id);
            }

            if (updatedUser.password !== user.password) {
                updatedUser.password = await hash(updatedUser.password);
            }

            map.set(params.id, updatedUser);

            await save()
        })

        broadcastEvent("users-updated", {})

        return new HTTPResponse(JSON.stringify({
            status: 200,
            message: "Updated user"
        }))
    }
}