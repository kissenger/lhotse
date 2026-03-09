import mongoose, {model} from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {type: String, required: true},
  hash: {type: String, required: true},
  email: {type: String, required: true},
  role: {type: String, required: true},
}, {timestamps: true})

const UserModel = model('user', userSchema);

export default UserModel; 
