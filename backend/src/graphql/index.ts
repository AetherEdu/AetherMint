import { Application, NextFunction, Request, RequestHandler, Response } from 'express';
import { ApolloServer } from 'apollo-server-express';
import {
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from 'apollo-server-core';
import { GraphQLError } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { getComplexity, fieldExtensionsEstimator, simpleEstimator } from 'graphql-query-complexity';
import logger from '../utils/logger';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { createGraphQLContext, GraphQLContext } from './context';
import { formatGraphQLError } from './errors';

const getMaxDepth = () => Number.parseInt(process.env.GRAPHQL_MAX_DEPTH || '10', 10);
const getMaxComplexity = () => Number.parseInt(process.env.GRAPHQL_MAX_COMPLEXITY || '200', 10);

export function createApolloServer(): ApolloServer {
  const isDev = process.env.NODE_ENV !== 'production';
  const maxDepth = getMaxDepth();
  const maxComplexity = getMaxComplexity();

  return new ApolloServer({
    typeDefs,
    resolvers: resolvers as any,
    context: ({ req }: { req: Request }) => createGraphQLContext({ req }),
    introspection: isDev,
    validationRules: [depthLimit(maxDepth)],
    formatError: formatGraphQLError as any,
    plugins: [
      isDev
        ? ApolloServerPluginLandingPageGraphQLPlayground({
            settings: {
              'request.credentials': 'include',
            },
          })
        : ApolloServerPluginLandingPageDisabled(),
      {
        async requestDidStart() {
          return {
            async didResolveOperation(requestContext: any) {
              const currentMaxComplexity = getMaxComplexity();
              const complexity = getComplexity({
                schema: requestContext.schema,
                operationName: requestContext.request.operationName,
                query: requestContext.document,
                variables: requestContext.request.variables || {},
                estimators: [
                  fieldExtensionsEstimator(),
                  simpleEstimator({ defaultComplexity: 1 }),
                ],
              });

              if (complexity > currentMaxComplexity) {
                throw new GraphQLError(
                  `Query is too complex: ${complexity}. Maximum allowed complexity: ${currentMaxComplexity}`,
                  {
                    extensions: {
                      code: 'QUERY_TOO_COMPLEX',
                      complexity,
                      maxComplexity: currentMaxComplexity,
                      http: { status: 400 },
                    },
                  }
                );
              }
            },
          };
        },
      },
    ],
  } as any);
}

export function createGraphQLPlaceholder(): {
  middleware: RequestHandler;
  start: () => Promise<ApolloServer>;
} {
  let apolloHandler: RequestHandler | null = null;
  let started: Promise<ApolloServer> | null = null;

  const middleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    if (!apolloHandler) {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'GraphQL endpoint is starting up. Please retry shortly.',
        },
      });
      return;
    }
    return apolloHandler(req, res, next);
  };

  const start = async (): Promise<ApolloServer> => {
    if (started) return started;

    started = (async () => {
      const apolloServer = createApolloServer();
      await apolloServer.start();

      apolloHandler = apolloServer.getMiddleware({
        path: '/',
        cors: false,
        bodyParserConfig: false,
      }) as unknown as RequestHandler;

      logger.info('GraphQL endpoint ready', {
        path: '/graphql',
        playground: process.env.NODE_ENV !== 'production',
        maxDepth: getMaxDepth(),
        maxComplexity: getMaxComplexity(),
      });

      return apolloServer;
    })();

    return started;
  };

  return { middleware, start };
}

export async function mountGraphQL(
  app: Application,
  preMiddleware: RequestHandler[] = []
): Promise<ApolloServer> {
  const apolloServer = createApolloServer();
  await apolloServer.start();

  const graphqlHandler = apolloServer.getMiddleware({
    path: '/graphql',
    cors: false,
    bodyParserConfig: false,
  }) as unknown as RequestHandler;

  app.use('/graphql', ...preMiddleware, graphqlHandler);

  logger.info('GraphQL endpoint mounted', {
    path: '/graphql',
    playground: process.env.NODE_ENV !== 'production',
    maxDepth: getMaxDepth(),
    maxComplexity: getMaxComplexity(),
  });

  return apolloServer;
}

export type { GraphQLContext };
