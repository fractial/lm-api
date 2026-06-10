import {Book} from "./schemas";
import {H3, serve} from "h3";
import {app as bookHandler} from "./routes/book"

const app = new H3()
    .mount("/book", bookHandler);

serve(app);