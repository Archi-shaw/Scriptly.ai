import Nextauth from "next-auth";
import { authoptions } from "./option";

const handler = Nextauth(authoptions); 
export {handler as GET, handler as POST}