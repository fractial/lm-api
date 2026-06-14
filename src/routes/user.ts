import {H3} from "h3";
import {User} from "../schemas/user";
import {auth} from "../schemas/auth";

export const app: H3 = new H3()
    .get('/', User.getAll, {middleware: [auth(true)]})
    .get('/:id', User.get, {middleware: [auth()]})
    .post('/', User.add)
    .patch('/:id', User.update, {middleware: [auth()]})
    .delete('/:id', User.remove, {middleware: [auth()]});