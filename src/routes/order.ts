import {H3} from "h3";
import {Order} from "../schemas/order";

export const app: H3 = new H3()
    .get('/', Order.getAll)
    .get('/:id', Order.get)
    .post('/', Order.add)
    .patch('/:id', Order.update)
    .delete('/:id', Order.remove);