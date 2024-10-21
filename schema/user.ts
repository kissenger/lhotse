import mongoose, {model} from 'mongoose';

const userSchema = new mongoose.Schema({
  userName: {type: String, required: true},
  hash: {type: String, required: true},
})

const UserModel = model('user', userSchema);

export default UserModel;
