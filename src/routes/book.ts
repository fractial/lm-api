import {H3} from "h3";
import {Book} from "../schemas/book";

export const app: H3 = new H3()
    .get('/', Book.getAll)
    .get('/:id', Book.get)
    .post('/', Book.add)
    .patch('/:id', Book.update)
    .delete('/:id', Book.remove);