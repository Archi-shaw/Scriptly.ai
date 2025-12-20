import Nextauth from "next-auth";
import { authOptions } from "./option";

const handler = Nextauth(authOptions); 
export {handler as GET, handler as POST}