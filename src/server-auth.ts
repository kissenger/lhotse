import express from 'express';
import UserModel from '@schema/user';
import bcrypt from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import { AuthError } from 'src/server';
import 'dotenv/config';

const auth = express();
const AUTH_KEY = process.env['AUTH_KEY'];

/*****************************************************************
 * ROUTE: Create paypal order
 ****************************************************************/

auth.post('/api/auth/login', async (req, res) => {

  try {

    const {username, password} = req.body.user;

    const user = await UserModel.findOne({username});
    if (!user) {
      throw new AuthError('User name not found.');
    };

    const passwordOK = await bcrypt.compare(password, user.hash);
    if (!passwordOK) {
      throw new AuthError('Password did not match');
    }

    const token = jsonwebtoken.sign({user: user.username, role: user.role}, <string>AUTH_KEY);
    res.status(200).send({token});

  } catch (error: any) {
    console.log(error.message);
    res.status(401).send(error);
  }

});

auth.post('/api/auth/register', async (req, res) => {
// take incoming user data in the form {email, password}, hash password,
// save to db, get json token and return to front end

  const saltRounds = 10;
  const user = req.body.user;

  try {
      
    // confirm that user name does not exist in db
    const userExists = await UserModel.findOne({username: user.username});
    if (!!userExists) {
      throw new AuthError('This user name is already registered');
    }

    // create user in the database
    const hash = await bcrypt.hash(user.password, saltRounds);
    const newUser = await UserModel.create({...user, hash});
    const token = jsonwebtoken.sign({...newUser}, <string>AUTH_KEY);
    res.status(200).send({token});    

  } catch (error) {
    console.log(error);
    res.status(401).send(error);
  }

});


/**
 * middleware to confirm user has an acceptable token. returns userId in req if all is ok
 */
function verifyToken(req: any, res: any, next: any) {

  try {

    if (!req.headers.authorization) {
      throw new AuthError('Unauthorised request: authorisation headers');
    }

    const token = req.headers.authorization;
    if ( token === 'null' ) {
      throw new AuthError('Unauthorised request: null token');
    }

    const payload = jsonwebtoken.verify(token, <string>AUTH_KEY);
    if ( !payload ) {
      throw new AuthError('Unauthorised request: invalid token');
    }
    
    // req.userId = payload.userId;
    // req.userName = payload.userName;
    // req.role = payload.role;

    next();

  } catch (error: any) {

    console.log(error)
    res.status(401).send(new AuthError(error.message));

  }

}

export {auth, verifyToken};