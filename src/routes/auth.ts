import {H3} from "h3";
import {Auth} from "../schemas/auth";

export const app: H3 = new H3()
    .post('/login', Auth.login)
    .post('/logout', Auth.logout)