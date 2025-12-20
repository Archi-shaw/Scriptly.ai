import { MongoClient } from "mongodb";

const url = process.env.MONGODB_URL!;
const options = {
     tls: true,
       family: 4,
  tlsAllowInvalidCertificates: true,
};

let client;
let clientPromise : Promise<MongoClient>;


if(!process.env.MONGODB_URL){
    throw new Error("PLease add ypur mongodb url");
}
if(process.env.NODE_ENV === "development"){
    if(!(global as any)._mongoClientPromise){
        client = new MongoClient(url, options);
         (global as any)._mongoClientPromise = client.connect();
    }
    clientPromise = (global as any)._mongoClientPromise;
}
else{
    client = new MongoClient(url,options);
    clientPromise = client.connect();
}
export default clientPromise;
