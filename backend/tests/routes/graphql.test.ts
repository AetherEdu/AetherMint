import express from 'express';
import request from 'supertest';
import { createApolloServer } from '../../src/graphql';

describe('GraphQL API Endpoint', () => {
  let app: express.Application;
  let apolloServer: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'test-secret';
    app = express();
    apolloServer = createApolloServer();
    await apolloServer.start();
    apolloServer.applyMiddleware({ app, path: '/graphql' });
  });

  afterAll(async () => {
    if (apolloServer) {
      await apolloServer.stop();
    }
  });

  it('serves Playground HTML on GET /graphql in development mode', async () => {
    const response = await request(app)
      .get('/graphql')
      .set('Accept', 'text/html');

    expect(response.status).toBe(200);
    expect(response.text).toContain('GraphQLPlayground');
  });

  it('executes courses query on POST /graphql successfully', async () => {
    const query = `
      query GetCourses {
        courses {
          courses {
            id
            title
          }
          total
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({ query });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('courses');
    expect(Array.isArray(response.body.data.courses.courses)).toBe(true);
  });

  it('enforces authentication on enrollInCourse mutation', async () => {
    const mutation = `
      mutation Enroll {
        enrollInCourse(input: { courseId: "course-123" }) {
          id
          status
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({ query: mutation });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain('Authentication required');
  });

  it('rejects overly complex queries', async () => {
    process.env.GRAPHQL_MAX_COMPLEXITY = '2';

    const complexServer = createApolloServer();
    await complexServer.start();
    const testApp = express();
    complexServer.applyMiddleware({ app: testApp, path: '/graphql' });

    const query = `
      query GetCourses {
        courses {
          courses {
            id
            title
            description
            tags
            skills
          }
        }
      }
    `;

    const response = await request(testApp)
      .post('/graphql')
      .send({ query });

    expect([200, 400]).toContain(response.status);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain('Query is too complex');

    delete process.env.GRAPHQL_MAX_COMPLEXITY;
    await complexServer.stop();
  });
});
