import {H3} from "h3";
import {Order} from "../schemas/order";
import {auth} from "../schemas/auth";

export const app: H3 = new H3()
    .get('/', Order.getAll, {middleware: [auth()]})
    .get('/:id', Order.get, {middleware: [auth()]})
    .post('/', Order.add, {middleware: [auth()]})
    .patch('/:id', Order.update, {middleware: [auth(true)]})
    .delete('/:id', Order.remove, {middleware: [auth(true)]});