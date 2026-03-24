import { Request, Response } from 'express';
import collaborationService from '../services/collaborationService';

/**
 * Collaboration controller
 * HTTP orchestration for virtual classrooms, workspaces, peer review, and study groups.
 */
class CollaborationController {
  async listClassrooms(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: collaborationService.listClassrooms()
    });
  }

  async createClassroom(req: Request, res: Response): Promise<void> {
    try {
      const { title, courseId, hostId, description, providerKind } = req.body;

      if (!title || !courseId || !hostId) {
        res.status(400).json({ success: false, message: 'Missing title, courseId, or hostId' });
        return;
      }

      const classroom = collaborationService.createClassroom({
        title,
        courseId,
        hostId,
        description,
        providerKind
      });

      res.status(201).json({ success: true, data: classroom });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async getClassroom(req: Request, res: Response): Promise<void> {
    try {
      const classroom = collaborationService.getClassroom(req.params.classroomId);
      const workspace = collaborationService.getDefaultWorkspaceForClassroom(req.params.classroomId);
      const summary = collaborationService.generateMeetingSummary(req.params.classroomId);

      res.status(200).json({
        success: true,
        data: {
          classroom,
          workspace,
          summary
        }
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async joinClassroom(req: Request, res: Response): Promise<void> {
    try {
      const { userId, name, role, currentRoomId, audioEnabled, videoEnabled } = req.body;

      if (!userId || !name) {
        res.status(400).json({ success: false, message: 'Missing userId or name' });
        return;
      }

      const classroom = collaborationService.joinClassroom(req.params.classroomId, {
        userId,
        name,
        role,
        currentRoomId,
        audioEnabled,
        videoEnabled
      });

      res.status(200).json({ success: true, data: classroom });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async leaveClassroom(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({ success: false, message: 'Missing userId' });
        return;
      }

      res.status(200).json({
        success: true,
        data: collaborationService.leaveClassroom(req.params.classroomId, userId)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async updateAttendance(req: Request, res: Response): Promise<void> {
    try {
      const { userId, status } = req.body;

      if (!userId || !status) {
        res.status(400).json({ success: false, message: 'Missing userId or attendance status' });
        return;
      }

      res.status(200).json({
        success: true,
        data: collaborationService.recordAttendance(req.params.classroomId, userId, status)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async updateHandRaise(req: Request, res: Response): Promise<void> {
    try {
      const { userId, raised } = req.body;

      if (!userId || typeof raised !== 'boolean') {
        res.status(400).json({ success: false, message: 'Missing userId or raised boolean' });
        return;
      }

      res.status(200).json({
        success: true,
        data: collaborationService.setHandRaise(req.params.classroomId, userId, raised)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async advanceQueue(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: collaborationService.advanceQueue(req.params.classroomId)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async setSessionState(req: Request, res: Response): Promise<void> {
    try {
      const { isRecording, playbackUrl, isLive, streamUrl, screenShareUserId, screenLabel, controls } = req.body;
      let classroom = collaborationService.getClassroom(req.params.classroomId);

      if (typeof isRecording === 'boolean') {
        classroom = collaborationService.setRecordingStatus(req.params.classroomId, isRecording, playbackUrl);
      }

      if (typeof isLive === 'boolean') {
        classroom = collaborationService.setStreamingStatus(req.params.classroomId, isLive, streamUrl);
      }

      if (screenShareUserId) {
        classroom = collaborationService.setScreenShare(req.params.classroomId, screenShareUserId, screenLabel);
      }

      if (screenShareUserId === null) {
        classroom = collaborationService.clearScreenShare(req.params.classroomId);
      }

      if (controls) {
        classroom = collaborationService.setPresenterControls(req.params.classroomId, controls);
      }

      res.status(200).json({ success: true, data: classroom });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async updateParticipantMediaState(req: Request, res: Response): Promise<void> {
    try {
      const { userId, audioEnabled, videoEnabled, screenShareEnabled, connectionQuality, lastNetworkEvent } = req.body;

      if (!userId) {
        res.status(400).json({ success: false, message: 'Missing userId' });
        return;
      }

      res.status(200).json({
        success: true,
        data: collaborationService.updateParticipantMediaState(req.params.classroomId, userId, {
          audioEnabled,
          videoEnabled,
          screenShareEnabled,
          connectionQuality,
          lastNetworkEvent
        })
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async enqueueSignal(req: Request, res: Response): Promise<void> {
    try {
      const { type, fromUserId, toUserId, payload } = req.body;

      if (!type || !fromUserId || !toUserId) {
        res.status(400).json({ success: false, message: 'Missing type, fromUserId, or toUserId' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.enqueueSignal(req.params.classroomId, {
          type,
          fromUserId,
          toUserId,
          payload: payload || {}
        })
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async pullSignals(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        res.status(400).json({ success: false, message: 'Missing userId' });
        return;
      }

      res.status(200).json({
        success: true,
        data: collaborationService.pullSignals(req.params.classroomId, userId)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async reportMediaQuality(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({ success: false, message: 'Missing userId' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.reportMediaQuality(req.params.classroomId, req.body)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async reportInterruption(req: Request, res: Response): Promise<void> {
    try {
      const { userId, reason } = req.body;

      if (!userId || !reason) {
        res.status(400).json({ success: false, message: 'Missing userId or reason' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.reportInterruption(req.params.classroomId, req.body)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async getMediaHealth(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: collaborationService.getMediaHealth(req.params.classroomId)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async addMessage(req: Request, res: Response): Promise<void> {
    try {
      const { userId, userName, body, emojis = [], files = [] } = req.body;

      if (!userId || !userName || !body) {
        res.status(400).json({ success: false, message: 'Missing userId, userName, or body' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.addMessage(req.params.classroomId, {
          userId,
          userName,
          body,
          emojis,
          files
        })
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async shareFile(req: Request, res: Response): Promise<void> {
    try {
      const { name, url, size, type, uploadedBy } = req.body;

      if (!name || !url || !uploadedBy) {
        res.status(400).json({ success: false, message: 'Missing name, url, or uploadedBy' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.shareFile(req.params.classroomId, {
          name,
          url,
          size,
          type,
          uploadedBy
        })
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async addWhiteboardStroke(req: Request, res: Response): Promise<void> {
    try {
      const { userId, color, width, points } = req.body;

      if (!userId || !Array.isArray(points) || points.length === 0) {
        res.status(400).json({ success: false, message: 'Missing userId or whiteboard points' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.addWhiteboardStroke(req.params.classroomId, {
          userId,
          color: color || '#1d4ed8',
          width: width || 2,
          points
        })
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async createPoll(req: Request, res: Response): Promise<void> {
    try {
      const { question, options, createdBy, closesAt } = req.body;

      if (!question || !Array.isArray(options) || options.length < 2 || !createdBy) {
        res.status(400).json({ success: false, message: 'Poll requires question, at least two options, and createdBy' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.createPoll(
          req.params.classroomId,
          question,
          options,
          createdBy,
          closesAt ? new Date(closesAt) : undefined
        )
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async respondToPoll(req: Request, res: Response): Promise<void> {
    try {
      const { optionId, userId } = req.body;

      if (!optionId || !userId) {
        res.status(400).json({ success: false, message: 'Missing optionId or userId' });
        return;
      }

      res.status(200).json({
        success: true,
        data: collaborationService.respondToPoll(req.params.classroomId, req.params.pollId, optionId, userId)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async createBreakoutRoom(req: Request, res: Response): Promise<void> {
    try {
      const { title, participantIds } = req.body;

      if (!title || !Array.isArray(participantIds)) {
        res.status(400).json({ success: false, message: 'Missing title or participantIds' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.createBreakoutRoom(req.params.classroomId, title, participantIds)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async listWorkspaces(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, data: collaborationService.listWorkspaces() });
  }

  async getWorkspace(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: collaborationService.getWorkspace(req.params.workspaceId)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async createWorkspace(req: Request, res: Response): Promise<void> {
    try {
      const { title, projectBrief, members, classroomId } = req.body;

      if (!title || !projectBrief || !Array.isArray(members)) {
        res.status(400).json({ success: false, message: 'Missing title, projectBrief, or members' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.createWorkspace({ title, projectBrief, members, classroomId })
      });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async syncDocument(req: Request, res: Response): Promise<void> {
    try {
      const { title, userId, version, updatedAt, content, strategy } = req.body;

      if (!title || !userId || version === undefined || !content) {
        res.status(400).json({ success: false, message: 'Missing title, userId, version, or content' });
        return;
      }

      res.status(200).json({
        success: true,
        data: collaborationService.syncDocument({
          workspaceId: req.params.workspaceId,
          documentId: req.params.documentId,
          title,
          userId,
          version: Number(version),
          updatedAt: updatedAt ? new Date(updatedAt) : undefined,
          content,
          strategy
        })
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async addWorkspaceNote(req: Request, res: Response): Promise<void> {
    try {
      const { userId, userName, body } = req.body;

      if (!userId || !userName || !body) {
        res.status(400).json({ success: false, message: 'Missing userId, userName, or body' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.addWorkspaceNote(req.params.workspaceId, userId, userName, body)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async addDiscussionPost(req: Request, res: Response): Promise<void> {
    try {
      const { userId, authorName, body } = req.body;

      if (!userId || !authorName || !body) {
        res.status(400).json({ success: false, message: 'Missing userId, authorName, or body' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.addDiscussionPost(req.params.workspaceId, userId, authorName, body)
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async listPeerReviews(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, data: collaborationService.listPeerReviews() });
  }

  async createPeerReview(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, submissionId, authorId, reviewerIds, rubric, dueAt } = req.body;

      if (!workspaceId || !submissionId || !authorId || !Array.isArray(reviewerIds) || !Array.isArray(rubric) || !dueAt) {
        res.status(400).json({ success: false, message: 'Missing peer review assignment fields' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.createPeerReviewAssignment(
          workspaceId,
          submissionId,
          authorId,
          reviewerIds,
          rubric,
          new Date(dueAt)
        )
      });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async submitPeerReview(req: Request, res: Response): Promise<void> {
    try {
      const { reviewerId, score, summary, strengths = [], improvements = [] } = req.body;

      if (!reviewerId || score === undefined || !summary) {
        res.status(400).json({ success: false, message: 'Missing reviewerId, score, or summary' });
        return;
      }

      res.status(200).json({
        success: true,
        data: collaborationService.submitPeerReview(
          req.params.assignmentId,
          reviewerId,
          Number(score),
          summary,
          strengths,
          improvements
        )
      });
    } catch (error) {
      res.status(404).json({ success: false, message: (error as Error).message });
    }
  }

  async listStudyGroups(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, data: collaborationService.listStudyGroups() });
  }

  async createStudyGroup(req: Request, res: Response): Promise<void> {
    try {
      const { topic, focusArea, members, recommendedSchedule, workspaceId } = req.body;

      if (!topic || !focusArea || !Array.isArray(members) || !recommendedSchedule) {
        res.status(400).json({ success: false, message: 'Missing topic, focusArea, members, or recommendedSchedule' });
        return;
      }

      res.status(201).json({
        success: true,
        data: collaborationService.createStudyGroup(topic, focusArea, members, recommendedSchedule, workspaceId)
      });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }
}

export default new CollaborationController();
