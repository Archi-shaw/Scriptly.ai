import { Users } from "lucide-react";
import mongoose, {Schema, Document} from "mongoose";

export interface User extends Document{
    _id: mongoose.Types.ObjectId,
    name: string,
    email: string,
    provider: string,
    providerId: string,
}

const UserSchema: Schema<User> = new Schema({
    name : {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    provider: {
        type: String,
    },
    providerId: {
        type: String,
    }
}, { 
    timestamps: true,
})

const UserModel  = (mongoose.models.User as mongoose.Model<User>) || mongoose.model<User>("User", UserSchema);
export default UserModel;