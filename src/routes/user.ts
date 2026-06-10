import {H3} from "h3";
import {User} from "../schemas/user";

export const app: H3 = new H3()
    .get('/', User.getAll)
    .get('/:id', User.get)
    .post('/', User.add)
    .patch('/:id', User.update)
    .delete('/:id', User.remove);