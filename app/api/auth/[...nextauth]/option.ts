import NextAuth, {NextAuthOptions} from "next-auth";
import GoogleProviders from "next-auth/providers/google";

export const authoptions :NextAuthOptions = {
    providers: [
        GoogleProviders({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
     session: {
        strategy: "jwt",
    },
    callbacks: {
        async jwt({token, account}) {
            if(account){
             token.accessToken = account.access_token;
            }
            return token;
        },

        async session({session , token}) {
        session.accessToken = token.accessToken as string;
          return session;
        }    
    },
}

const handler = NextAuth(authoptions);
export {handler as GET , handler as POST};