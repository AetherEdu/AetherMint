import collaborationService from '../../src/services/collaborationService';

describe('Collaboration Service', () => {
  it('merges collaborative document updates without losing server fields', () => {
    const workspace = collaborationService.createWorkspace({
      title: 'Conflict Resolution Lab',
      projectBrief: 'Exercise document merge behavior',
      members: ['student_a', 'student_b']
    });

    const initialDocument = collaborationService.syncDocument({
      workspaceId: workspace.id,
      documentId: 'doc_merge_case',
      title: 'Merge Notes',
      userId: 'student_a',
      version: 0,
      content: {
        title: 'Plan',
        sections: {
          intro: 'Initial draft'
        }
      },
      strategy: 'merge'
    });

    const mergedDocument = collaborationService.syncDocument({
      workspaceId: workspace.id,
      documentId: 'doc_merge_case',
      title: 'Merge Notes',
      userId: 'student_b',
      version: initialDocument.version - 1,
      content: {
        sections: {
          tasks: 'Added action items'
        }
      },
      strategy: 'merge'
    });

    expect((mergedDocument.content as any).sections).toEqual({
      intro: 'Initial draft',
      tasks: 'Added action items'
    });
    expect(mergedDocument.version).toBeGreaterThan(initialDocument.version);
  });

  it('generates an actionable meeting summary from classroom activity', () => {
    const classroom = collaborationService.createClassroom({
      title: 'Summary Workshop',
      courseId: 'course_summary',
      hostId: 'instructor_summary'
    });

    collaborationService.joinClassroom(classroom.id, {
      userId: 'student_summary',
      name: 'Summary Student'
    });

    collaborationService.addMessage(classroom.id, {
      userId: 'student_summary',
      userName: 'Summary Student',
      body: 'We should add attendance reminders before the quiz starts.',
      emojis: ['💡'],
      files: []
    });

    const workspace = collaborationService.createWorkspace({
      title: 'Summary Workspace',
      projectBrief: 'Track action items',
      members: ['student_summary'],
      classroomId: classroom.id
    });

    collaborationService.addWorkspaceNote(workspace.id, 'student_summary', 'Summary Student', 'Owner: student_summary, task: draft reminder flow');

    const summary = collaborationService.generateMeetingSummary(classroom.id);

    expect(summary.summary).toContain('Summary Student');
    expect(summary.actionItems[0]).toContain('Owner');
  });

  it('queues media signals and clears them after retrieval', () => {
    const classroom = collaborationService.createClassroom({
      title: 'Signal Room',
      courseId: 'course_signals',
      hostId: 'instructor_signal'
    });

    collaborationService.enqueueSignal(classroom.id, {
      type: 'offer',
      fromUserId: 'student_a',
      toUserId: 'student_b',
      payload: { sdp: 'abc', type: 'offer' }
    });

    const pulled = collaborationService.pullSignals(classroom.id, 'student_b');
    const afterPull = collaborationService.pullSignals(classroom.id, 'student_b');

    expect(pulled).toHaveLength(1);
    expect(pulled[0].fromUserId).toBe('student_a');
    expect(afterPull).toHaveLength(0);
  });

  it('grades poor media quality and logs interruption events', () => {
    const classroom = collaborationService.createClassroom({
      title: 'Media Health',
      courseId: 'course_media',
      hostId: 'instructor_media'
    });

    collaborationService.joinClassroom(classroom.id, {
      userId: 'student_media',
      name: 'Media Student'
    });

    const report = collaborationService.reportMediaQuality(classroom.id, {
      userId: 'student_media',
      packetLossPct: 15,
      roundTripTimeMs: 980,
      jitterMs: 60
    });

    const interruption = collaborationService.reportInterruption(classroom.id, {
      userId: 'student_media',
      reason: 'offline',
      details: 'Wi-Fi disconnected'
    });

    const mediaHealth = collaborationService.getMediaHealth(classroom.id);

    expect(report.packetLossPct).toBe(15);
    expect(interruption.reason).toBe('offline');
    expect(mediaHealth.participantSummary.find((participant) => participant.userId === 'student_media')?.connectionQuality).toBe('offline');
  });
});
