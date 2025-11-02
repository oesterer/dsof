import cors from 'cors';
import bodyParser from 'body-parser';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { serverConfig } from './config.js';
import { getPool, shutdownPool } from './db.js';
import { resolvers, GraphQLContext } from './resolvers.js';
import { typeDefs } from './schema.js';

async function bootstrap() {
  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
  });

  await server.start();

  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async () => ({
        db: getPool(),
      }),
    })
  );

  const httpServer = app.listen(serverConfig.port, () => {
    console.log(`🚀 GraphQL server ready at http://localhost:${serverConfig.port}/graphql`);
  });

  const shutdown = async () => {
    console.log('\nShutting down GraphQL server...');
    await server.stop();
    httpServer.close(() => {
      console.log('HTTP server closed.');
    });
    await shutdownPool();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error('Failed to start GraphQL server:', error);
  process.exit(1);
});
