import { DefaultSession } from "next-auth";


declare module "next-auth" {
    interface Session extends DefaultSssion {
        accessToken?: string; 
    }
    interface jwt {
        accessToken?: string;
    } 
    interface Seession {
        user: {
            id: string,
            name?: string | null,
            email?: string | null,
            image?: string|null,
        }
    }
}