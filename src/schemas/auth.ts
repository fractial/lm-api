import {type EventHandlerRequest, type H3Event, HTTPError, readValidatedBody, type HTTPEvent, onRequest} from "h3";
import {generateJWK, useJWESession, useJWSSession} from "unjwt/adapters/h3v2";
import * as v from "valibot";
import {type User, userRegisterSchema} from "./user";
import {mailMap, userMap} from "../data";
import {getJWESession, updateJWSSession} from "unjwt/adapters/h3v2";
import {argon2d, verify} from "argon2";
import type {SessionClaims, SessionConfigJWE, SessionConfigJWS, SessionManager} from "unjwt/adapters/h3v2";
import * as console from "node:console";

export const loginSchema = v.strictObject({
    email: v.pipe(v.string(), v.email()),
    password: v.pipe(v.string(), v.minLength(8)),
});

const atJwk = await generateJWK("RS256");

const jweOptions: SessionConfigJWE<SessionClaims, number, H3Event<EventHandlerRequest>> = {
    key: "refresh_token_secret",
    name: "refresh_token",
    sessionHeader: "Authorization",
    maxAge: 7 * 24 * 60 * 60, // 7 days
};

export const jwsOptions: SessionConfigJWS<SessionClaims, number, H3Event<EventHandlerRequest>> = {
    key: atJwk,
    name: "access_token",
    sessionHeader: "Authorization",
    maxAge: 15 * 60, // 15 minutes
    hooks: {
        async onExpire({ event, config }) {
            const refreshSession = await getJWESession(event, jweOptions);
            if (!refreshSession.data.sub) {
                // no valid refresh session, nothing to do
                return;
            }

            console.log("Access token expired, refreshing...");

            // refresh the access token
            await updateJWSSession(event, config, {
                sub: refreshSession.data.sub,
                scope: refreshSession.data.scope,
            });
        },
    },
};

type LoginResult = {
    accessToken: {
        id: string | undefined;
        createdAt: number;
        expiresAt: number | undefined;
        data: Record<string, unknown>;
        token: string | undefined;
    };
    refreshSession: {
        id: string | undefined;
        createdAt: number;
        expiresAt: number;
        data: Record<string, unknown>;
        token: string | undefined;
    };
};

interface JWTAuth {
    accessSession:  SessionManager<SessionClaims, number>;
    user: User;
}

declare module "h3" {
    export interface H3EventContext {
        jwtAuth?: JWTAuth;
    }
}

export const auth = (isAdmin?: boolean) => onRequest(async (event) => {
    const accessSession = await useJWSSession(event, jwsOptions);

    console.log("Access session", accessSession.data.sub);

    if (!accessSession.data.sub) {
        throw new HTTPError("Unauthorized", { status: 401 });
    }

    const data = accessSession.data;

    const user = await userMap.get(data.sub!);

    if (!user) {
        throw new HTTPError("User not found", { status: 404 });
    }

    if (isAdmin && !user.isAdmin) {
        throw new HTTPError("User missing admin privileges", { status: 401 });
    }

    event.context.jwtAuth = {
        accessSession,
        user
    } satisfies JWTAuth;
});

export namespace Auth {
    export async function login(event: H3Event<EventHandlerRequest>): Promise<LoginResult> {
        const refreshSession = await useJWESession(event, jweOptions);
        const accessSession = await useJWSSession(event, jwsOptions);

        if (accessSession.data.sub) {
            // user already logged in, return existing info
            return {
                accessToken: {
                    id: accessSession.id,
                    createdAt: accessSession.createdAt,
                    expiresAt: accessSession.expiresAt,
                    data: accessSession.data,
                    token: accessSession.token
                },
                refreshSession: {
                    id: refreshSession.id,
                    createdAt: refreshSession.createdAt,
                    expiresAt: refreshSession.expiresAt,
                    data: refreshSession.data,
                    token: refreshSession.token
                },
            };
        }

        const body = await readValidatedBody(event, loginSchema);
        const userMail = await mailMap.get(body.email);
        if (!userMail) {
            throw new HTTPError("Invalid credentials", { status: 401 });
        }
        const user = await userMap.get(userMail);
        if (!user || !(await verify(user.password, body.password))) {
            throw new HTTPError("Invalid credentials", { status: 401 });
        }

        const claims = {
            sub: user.id,
            scope: [user.isAdmin ? "admin" : "user"],
        };

        await accessSession.update(claims);

        await refreshSession.update(claims);

        return {
            accessToken: {
                id: accessSession.id,
                createdAt: accessSession.createdAt,
                expiresAt: accessSession.expiresAt,
                data: accessSession.data,
                token: accessSession.token
            },
            refreshSession: {
                id: refreshSession.id,
                createdAt: refreshSession.createdAt,
                expiresAt: refreshSession.expiresAt,
                data: refreshSession.data,
                token: refreshSession.token
            },
        };
    }

    export async function logout(event: H3Event<EventHandlerRequest>): Promise<void> {
        const refreshSession = await useJWESession(event, jweOptions);
        const accessSession = await useJWSSession(event, jwsOptions);

        await refreshSession.update(undefined as any);
        await accessSession.update(undefined as any);
    }
}