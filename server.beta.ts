import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';
// import { MongoClient } from 'mongodb'
import mongoose from 'mongoose';


// **** API setup - added gst
import 'dotenv/config'
// import { MongoClient, ServerApiVersion } from 'mongodb';
// import ContactsModel from './schema/contact';
// import { MongoClient, ServerApiVersion } from 'mongodb';


const pwd = process.env['MONGODB_PASSWORD'];
const db = process.env['MONGODB_DBNAME'];
const cs = `mongodb+srv://root:Gudd5QfVXUMI2uzS@cluster0-5h6di.gcp.mongodb.net/snorkelology?retryWrites=true&w=majority&appName=Cluster0`;
// console.log(cs);

// console.log('boobies')
// const client = new MongoClient(cs, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   }
// });

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect(cs);

  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}

// try {
//   const client = new MongoClient(cs, {
//     // serverApi: ServerApiVersion.v1
//   });
//   client.connect().then( (conn) => {
//     console.log('MongoDB connected')
//   });
// } catch(e) {
//   // console.log(e)
// }

// let conn; 

// try {

// } catch(e) {
//   console.error(e);
//   console.log('MongoDB Error')
// }
// mongoose.connection
//   .on('error', console.error.bind(console, 'connection error:'))
//   .on('close', () => console.log('MongoDB disconnected'))
//   .once('open', () => console.log('MongoDB connected') );
// **** End of API setup

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();
  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  
  // *** API Endpoints
    
  server.use(express.json());
  server.get('/api/ping/', (req, res) => {
    res.status(201).json({hello: 'world'});
  })

  // server.post('/api/store-email', async (req, res) => {
  //   try {
  //     const newDocument = await ContactsModel.create( {email: req.body.email} );
  //     res.status(201).json({_id: newDocument});
  //   } catch (error: any) {
  //     res.status(500).send(error.message);
  //   }
  // });

// *** End of API Endpoints


  server.get('*.*', express.static(browserDistFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Angular engine
  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();
