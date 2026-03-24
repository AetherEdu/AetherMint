const express = require('express');
const request = require('supertest');
const createSearchRouter = require('../../src/routes/search');
const { DiscoveryService } = require('../../src/services/discoveryService');

describe('Search routes', () => {
    let app;
    let service;

    beforeEach(() => {
        service = new DiscoveryService();
        service.resetState();

        app = express();
        app.use(express.json());
        app.use('/api/search', createSearchRouter(service));
    });

    it('returns search results with analytics and facets', async () => {
        const response = await request(app).get('/api/search').query({ q: 'voice search', sessionId: 'route-session' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.results.length).toBeGreaterThan(0);
        expect(response.body.data.analytics.engine).toBe('starked-discovery-in-memory');
        expect(response.body.data.facets.categories.length).toBeGreaterThan(0);
    });

    it('persists saved searches and alerts', async () => {
        const savedResponse = await request(app)
            .post('/api/search/saved-searches')
            .send({
                name: 'AI searches',
                query: 'AI',
                filters: { categories: ['Artificial Intelligence'] },
                sessionId: 'route-session'
            });

        const alertResponse = await request(app)
            .post('/api/search/alerts')
            .send({
                query: 'AI',
                filters: { categories: ['Artificial Intelligence'] },
                sessionId: 'route-session',
                frequency: 'daily',
                channel: 'in-app'
            });

        const savedList = await request(app).get('/api/search/saved-searches').query({ sessionId: 'route-session' });
        const alertList = await request(app).get('/api/search/alerts').query({ sessionId: 'route-session' });

        expect(savedResponse.status).toBe(201);
        expect(alertResponse.status).toBe(201);
        expect(savedList.body.data.items).toHaveLength(1);
        expect(alertList.body.data.items).toHaveLength(1);
    });

    it('returns 404 for similar results when the source course does not exist', async () => {
        const response = await request(app).get('/api/search/similar/missing-course');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
    });
});