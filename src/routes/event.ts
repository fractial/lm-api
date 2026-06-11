import {H3} from "h3";
import {Event} from "../schemas/event";

export const app: H3 = new H3()
    .get('/', Event.getAll)
    .get('/:id', Event.get)
    .post('/', Event.add)
    .patch('/:id', Event.update)
    .delete('/:id', Event.remove);