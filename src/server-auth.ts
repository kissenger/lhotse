import express from 'express';
import UserModel from '@schema/user';
import bcrypt from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import { AuthError } from 'src/server';
import 'dotenv/config';

const auth = express();
const AUTH_KEY = process.env['AUTH_KEY'];

const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

/** Options for the HttpOnly JWT cookie */
const tokenCookieOpts = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  maxAge: COOKIE_MAX_AGE_MS,
  path: '/',
};

/** Options for the non-HttpOnly presence cookie (JS-readable, used to check logged-in state) */
const sessionCookieOpts = {
  httpOnly: false,
  secure: true,
  sameSite: 'strict' as const,
  maxAge: COOKIE_MAX_AGE_MS,
  path: '/',
};

/*****************************************************************
 * ROUTE: Create paypal order
 ****************************************************************/

auth.post('/api/auth/login', async (req, res) => {

  try {

    const {username, password} = req.body.user;

    // Use a consistent response for both "not found" and "wrong password" to
    // prevent user enumeration attacks (timing is equalised by always calling bcrypt).
    const user = await UserModel.findOne({username});
    const dummyHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
    const passwordOK = await bcrypt.compare(password, user?.hash ?? dummyHash);
    if (!user || !passwordOK) {
      throw new AuthError('Invalid credentials.');
    }

    const token = jsonwebtoken.sign(
      { user: user.username, role: user.role },
      <string>AUTH_KEY,
      { expiresIn: '24h' }
    );
    res.cookie('__sn_token', token, tokenCookieOpts);
    res.cookie('__sn_session', '1', sessionCookieOpts);
    res.status(200).send({ success: true });

  } catch (error: any) {
    res.status(401).send({ message: error.message ?? 'Login failed' });
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
    // Only embed non-sensitive fields in the JWT (never include the hash)
    const token = jsonwebtoken.sign(
      { user: newUser.username, role: newUser.role },
      <string>AUTH_KEY,
      { expiresIn: '24h' }
    );
    res.status(200).send({token});    

  } catch (error: any) {
    res.status(401).send({ message: error.message ?? 'Registration failed' });
  }

});


auth.post('/api/auth/logout', (_req, res) => {
  const clearOpts = { path: '/', secure: true, sameSite: 'strict' as const };
  res.clearCookie('__sn_token', clearOpts);
  res.clearCookie('__sn_session', clearOpts);
  res.status(200).send({ success: true });
});


/**
 * middleware to confirm user has an acceptable token. returns userId in req if all is ok
 */
function verifyToken(req: any, res: any, next: any) {

  try {

    const token = req.cookies?.__sn_token;
    if (!token) {
      throw new AuthError('Unauthorised request: missing token');
    }

    const payload = jsonwebtoken.verify(token, <string>AUTH_KEY);
    if ( !payload ) {
      throw new AuthError('Unauthorised request: invalid token');
    }
    
    next();

  } catch (error: any) {
    res.status(401).send(new AuthError(error.message));

  }

}

export {auth, verifyToken};