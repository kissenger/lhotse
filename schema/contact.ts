import mongoose, {model} from 'mongoose';

const contactSchema = new mongoose.Schema({
  email: {type: String, required: true},
  timeStamp: {type: Date, default: Date.now, required: true},
})

const ContactsModel = model('contacts', contactSchema);

export default ContactsModel;
