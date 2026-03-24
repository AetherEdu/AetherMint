const request = require('supertest');
const app = require('../../src/index');

describe('Collaboration API Tests', () => {
  let classroomId;
  let workspaceId;
  let pollId;
  let optionId;

  beforeEach(async () => {
    const classroomsResponse = await request(app).get('/api/collaboration/classrooms');
    classroomId = classroomsResponse.body.data[0].id;

    const detailResponse = await request(app).get(`/api/collaboration/classrooms/${classroomId}`);
    workspaceId = detailResponse.body.data.workspace.id;
  });

  it('should list seeded classrooms', async () => {
    const response = await request(app).get('/api/collaboration/classrooms');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('should join a classroom and track attendance', async () => {
    const response = await request(app)
      .post(`/api/collaboration/classrooms/${classroomId}/join`)
      .send({
        userId: 'student_join_test',
        name: 'Realtime Student'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.participants.some((participant) => participant.userId === 'student_join_test')).toBe(true);
    expect(response.body.data.attendance.some((record) => record.userId === 'student_join_test')).toBe(true);
  });

  it('should create and respond to a poll', async () => {
    const createResponse = await request(app)
      .post(`/api/collaboration/classrooms/${classroomId}/polls`)
      .send({
        question: 'Which realtime feature matters most?',
        options: ['Chat', 'Whiteboard', 'Breakout rooms'],
        createdBy: 'instructor_1'
      });

    expect(createResponse.status).toBe(201);
    pollId = createResponse.body.data.id;
    optionId = createResponse.body.data.options[0].id;

    const response = await request(app)
      .post(`/api/collaboration/classrooms/${classroomId}/polls/${pollId}/respond`)
      .send({
        optionId,
        userId: 'student_poll_test'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.options[0].votes).toContain('student_poll_test');
  });

  it('should queue and deliver signaling events for WebRTC negotiation', async () => {
    const createSignalResponse = await request(app)
      .post(`/api/collaboration/classrooms/${classroomId}/signals`)
      .send({
        type: 'offer',
        fromUserId: 'student_a',
        toUserId: 'student_b',
        payload: { sdp: 'fake-sdp', type: 'offer' }
      });

    expect(createSignalResponse.status).toBe(201);
    expect(createSignalResponse.body.data.type).toBe('offer');

    const pullResponse = await request(app)
      .get(`/api/collaboration/classrooms/${classroomId}/signals?userId=student_b`);

    expect(pullResponse.status).toBe(200);
    expect(pullResponse.body.data).toHaveLength(1);
    expect(pullResponse.body.data[0].fromUserId).toBe('student_a');
  });

  it('should accept quality and interruption reports', async () => {
    await request(app)
      .post(`/api/collaboration/classrooms/${classroomId}/join`)
      .send({
        userId: 'student_media_test',
        name: 'Media Learner'
      });

    const qualityResponse = await request(app)
      .post(`/api/collaboration/classrooms/${classroomId}/media-quality`)
      .send({
        userId: 'student_media_test',
        packetLossPct: 9,
        roundTripTimeMs: 410,
        jitterMs: 45,
        frameRate: 24
      });

    expect(qualityResponse.status).toBe(201);
    expect(qualityResponse.body.success).toBe(true);

    const interruptionResponse = await request(app)
      .post(`/api/collaboration/classrooms/${classroomId}/interruptions`)
      .send({
        userId: 'student_media_test',
        reason: 'offline',
        details: 'Connection dropped during live stream'
      });

    expect(interruptionResponse.status).toBe(201);

    const healthResponse = await request(app)
      .get(`/api/collaboration/classrooms/${classroomId}/media-health`);

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body.data.latestReports.length).toBeGreaterThan(0);
    expect(healthResponse.body.data.interruptions.length).toBeGreaterThan(0);
  });

  it('should sync a collaborative document', async () => {
    const response = await request(app)
      .post(`/api/collaboration/workspaces/${workspaceId}/documents/doc_live_sync/sync`)
      .send({
        title: 'Team Notes',
        userId: 'student_doc_test',
        version: 0,
        content: {
          blocks: [
            { type: 'paragraph', text: 'Shared notes created during the session.' }
          ]
        },
        strategy: 'merge'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe('Team Notes');
    expect(response.body.data.version).toBeGreaterThan(0);
  });

  it('should create a study group and peer review assignment', async () => {
    const studyGroupResponse = await request(app)
      .post('/api/collaboration/study-groups')
      .send({
        topic: 'Peer Learning Circle',
        focusArea: 'Reviewing drafts together',
        members: ['student_1', 'student_2'],
        recommendedSchedule: 'Mondays 16:00 WAT',
        workspaceId
      });

    expect(studyGroupResponse.status).toBe(201);
    expect(studyGroupResponse.body.data.members).toEqual(['student_1', 'student_2']);

    const peerReviewResponse = await request(app)
      .post('/api/collaboration/peer-review')
      .send({
        workspaceId,
        submissionId: 'submission_1',
        authorId: 'student_1',
        reviewerIds: ['student_2', 'student_3'],
        rubric: ['clarity', 'evidence'],
        dueAt: new Date(Date.now() + 86400000).toISOString()
      });

    expect(peerReviewResponse.status).toBe(201);
    expect(peerReviewResponse.body.data.workspaceId).toBe(workspaceId);
    expect(peerReviewResponse.body.data.reviewerIds).toContain('student_2');
  });
});
