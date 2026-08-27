/**
 * Engagement-aware content adaptation tests (issue #408)
 *
 * Unit-tests the deterministic adaptation rules (pacing / difficulty /
 * hints), user overrides, privacy & consent controls, and effectiveness
 * measurement. Then exercises the HTTP layer with supertest using a
 * signed JWT (JWT_SECRET is provided by backend/tests/setup.js).
 */

import jwt from 'jsonwebtoken';
import express from 'express';
import request from 'supertest';
import {
  AdaptationService,
  adaptationService,
} from '../services/adaptation/AdaptationService';
import adaptationRoutes from '../routes/adaptation';

const makeToken = (id = 'user-1') =>
  jwt.sign(
    { id, username: 'learner', role: 'student', email: 'learner@test.dev' },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' },
  );

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/adaptation', adaptationRoutes);
  return app;
};

describe('AdaptationService (unit)', () => {
  let service: AdaptationService;

  beforeEach(() => {
    service = new AdaptationService();
  });

  describe('signal ingestion & consent', () => {
    it('does not store signals without engagement tracking consent', () => {
      const result = service.ingestSignal('u1', {
        engagementScore: 45,
        frustrationScore: 80,
        dominantEmotion: 'angry',
      });
      expect(result.stored).toBe(false);
      expect(service.getSignals('u1')).toHaveLength(0);
    });

    it('stores signals once consent is granted', () => {
      service.setConsent('u1', { engagementTrackingConsent: true });
      const result = service.ingestSignal('u1', {
        engagementScore: 45,
        frustrationScore: 80,
        dominantEmotion: 'angry',
      });
      expect(result.stored).toBe(true);
      expect(service.getSignals('u1')).toHaveLength(1);
    });

    it('clamps out-of-range scores and invalid emotions', () => {
      service.setConsent('u1', { engagementTrackingConsent: true });
      service.ingestSignal('u1', {
        engagementScore: 500,
        frustrationScore: -10,
        dominantEmotion: 'not-an-emotion' as any,
      });
      const stored = service.getSignals('u1')[0];
      expect(stored.engagementScore).toBe(100);
      expect(stored.frustrationScore).toBe(0);
      expect(stored.dominantEmotion).toBe('neutral');
    });
  });

  describe('adaptation rules (explainable + overridable)', () => {
    it('offers review when frustration exceeds 75', () => {
      const rec = service.recommend('u1', {
        engagementScore: 40,
        frustrationScore: 90,
        dominantEmotion: 'angry',
      });
      expect(rec.action.kind).toBe('offer_review');
      expect(rec.rule).toBe('frustration-review');
      expect(rec.explanation).toContain('90');
      expect(rec.overridable).toBe(true);
    });

    it('slows pacing when frustration is high but below the review threshold', () => {
      const rec = service.recommend('u1', {
        engagementScore: 50,
        frustrationScore: 65,
        dominantEmotion: 'sad',
      });
      expect(rec.action.kind).toBe('slow_down');
      expect(rec.action.playbackRate).toBe(0.75);
    });

    it('offers a hint when engagement drops below 30', () => {
      const rec = service.recommend('u1', {
        engagementScore: 20,
        frustrationScore: 10,
        dominantEmotion: 'neutral',
      });
      expect(rec.action.kind).toBe('offer_hint');
    });

    it('speeds up pacing for highly engaged learners', () => {
      const rec = service.recommend('u1', {
        engagementScore: 95,
        frustrationScore: 10,
        dominantEmotion: 'happy',
      });
      expect(rec.action.kind).toBe('speed_up');
      expect(rec.action.playbackRate).toBe(1.25);
    });

    it('keeps standard pacing in the healthy band', () => {
      const rec = service.recommend('u1', {
        engagementScore: 60,
        frustrationScore: 20,
        dominantEmotion: 'neutral',
      });
      expect(rec.action.kind).toBe('none');
    });

    it('respects the master adaptationEnabled preference', () => {
      service.setPreferences('u1', { adaptationEnabled: false });
      const rec = service.recommend('u1', {
        engagementScore: 10,
        frustrationScore: 95,
        dominantEmotion: 'angry',
      });
      expect(rec.action.kind).toBe('none');
      expect(rec.rule).toBe('preference-disabled');
    });

    it('respects per-dimension overrides (pacing disabled → no slow down)', () => {
      service.setPreferences('u1', { pacingEnabled: false });
      const rec = service.recommend('u1', {
        engagementScore: 50,
        frustrationScore: 65,
        dominantEmotion: 'sad',
      });
      expect(rec.action.kind).not.toBe('slow_down');
      expect(['offer_review', 'offer_hint', 'simplify', 'none']).toContain(rec.action.kind);
    });

    it('respects per-dimension overrides (hints disabled → no hint)', () => {
      service.setPreferences('u1', { hintsEnabled: false });
      const rec = service.recommend('u1', {
        engagementScore: 20,
        frustrationScore: 10,
        dominantEmotion: 'neutral',
      });
      expect(rec.action.kind).not.toBe('offer_hint');
    });

    it('clamps playback bounds via preferences', () => {
      const prefs = service.setPreferences('u1', {
        maxPlaybackRate: 5,
        minPlaybackRate: 0,
      });
      expect(prefs.maxPlaybackRate).toBe(2);
      expect(prefs.minPlaybackRate).toBe(0.25);
    });
  });

  describe('privacy & consent controls', () => {
    it('revoking consent purges stored signals (right-to-erasure)', () => {
      service.setConsent('u1', { engagementTrackingConsent: true });
      service.ingestSignal('u1', {
        engagementScore: 50,
        frustrationScore: 50,
        dominantEmotion: 'neutral',
      });
      expect(service.getSignals('u1')).toHaveLength(1);

      service.setConsent('u1', { engagementTrackingConsent: false });
      expect(service.getSignals('u1')).toHaveLength(0);
      expect(service.getConsent('u1').revokedAt).toBeDefined();
    });

    it('purgeUserData clears every store', () => {
      service.setConsent('u1', { engagementTrackingConsent: true });
      service.ingestSignal('u1', {
        engagementScore: 50,
        frustrationScore: 50,
        dominantEmotion: 'neutral',
      });
      service.recommend('u1', {
        engagementScore: 50,
        frustrationScore: 50,
        dominantEmotion: 'neutral',
      });
      service.purgeUserData('u1');
      expect(service.getSignals('u1')).toHaveLength(0);
      expect(service.getRecommendations('u1')).toHaveLength(0);
      expect(service.getEffectiveness('u1')).toHaveLength(0);
    });
  });

  describe('effectiveness measurement', () => {
    it('aggregates acceptance rate and score deltas per action', () => {
      const rec1 = service.recommend('u1', {
        engagementScore: 90,
        frustrationScore: 10,
        dominantEmotion: 'happy',
      });
      const rec2 = service.recommend('u1', {
        engagementScore: 90,
        frustrationScore: 10,
        dominantEmotion: 'happy',
      });

      service.recordOutcome('u1', {
        recommendationId: rec1.id,
        accepted: true,
        quizScoreAfter: 90,
      });
      service.recordOutcome('u1', {
        recommendationId: rec2.id,
        accepted: false,
        quizScoreAfter: 55,
      });

      const effectiveness = service.getEffectiveness('u1');
      const speedUp = effectiveness.find((e) => e.action === 'speed_up');
      expect(speedUp).toBeDefined();
      expect(speedUp!.samples).toBe(2);
      expect(speedUp!.acceptanceRate).toBe(0.5);
      expect(speedUp!.averageScoreDelta).toBeGreaterThan(0);
    });
  });
});

describe('Adaptation routes (HTTP)', () => {
  const app = buildApp();

  beforeEach(() => {
    adaptationService.reset();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/adaptation/preferences');
    expect(res.status).toBe(401);
  });

  it('ingests a signal with a valid token', async () => {
    const res = await request(app)
      .post('/api/adaptation/signal')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ engagementScore: 40, frustrationScore: 80, dominantEmotion: 'angry' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects a malformed signal payload', async () => {
    const res = await request(app)
      .post('/api/adaptation/signal')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ dominantEmotion: 'angry' });
    expect(res.status).toBe(400);
  });

  it('returns an explainable, overridable recommendation', async () => {
    const res = await request(app)
      .post('/api/adaptation/recommend')
      .set('Authorization', `Bearer ${makeToken('learner-1')}`)
      .send({ engagementScore: 20, frustrationScore: 10, dominantEmotion: 'neutral' });
    expect(res.status).toBe(200);
    expect(res.body.data.action.kind).toBe('offer_hint');
    expect(res.body.data.explanation.length).toBeGreaterThan(0);
    expect(res.body.data.overridable).toBe(true);
  });

  it('updates and reads preferences', async () => {
    const update = await request(app)
      .put('/api/adaptation/preferences')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ pacingEnabled: false });
    expect(update.status).toBe(200);
    expect(update.body.data.pacingEnabled).toBe(false);

    const read = await request(app)
      .get('/api/adaptation/preferences')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(read.status).toBe(200);
    expect(read.body.data.pacingEnabled).toBe(false);
  });

  it('grants and revokes consent via the API', async () => {
    const grant = await request(app)
      .put('/api/adaptation/consent')
      .set('Authorization', `Bearer ${makeToken('consent-user')}`)
      .send({ engagementTrackingConsent: true });
    expect(grant.status).toBe(200);
    expect(grant.body.data.engagementTrackingConsent).toBe(true);

    const revoke = await request(app)
      .put('/api/adaptation/consent')
      .set('Authorization', `Bearer ${makeToken('consent-user')}`)
      .send({ engagementTrackingConsent: false });
    expect(revoke.status).toBe(200);
    expect(revoke.body.data.revokedAt).toBeDefined();
  });

  it('records outcomes and reports effectiveness', async () => {
    const recRes = await request(app)
      .post('/api/adaptation/recommend')
      .set('Authorization', `Bearer ${makeToken('effect-user')}`)
      .send({ engagementScore: 95, frustrationScore: 5, dominantEmotion: 'happy' });
    const recId = recRes.body.data.id;

    const outcome = await request(app)
      .post('/api/adaptation/outcome')
      .set('Authorization', `Bearer ${makeToken('effect-user')}`)
      .send({ recommendationId: recId, accepted: true, quizScoreAfter: 88 });
    expect(outcome.status).toBe(200);

    const effectiveness = await request(app)
      .get('/api/adaptation/effectiveness')
      .set('Authorization', `Bearer ${makeToken('effect-user')}`);
    expect(effectiveness.status).toBe(200);
    expect(effectiveness.body.data.length).toBeGreaterThan(0);
  });

  it('purges all user data', async () => {
    const res = await request(app)
      .delete('/api/adaptation/purge')
      .set('Authorization', `Bearer ${makeToken('purge-user')}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('purged');
  });
});
