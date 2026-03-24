import { Router } from 'express';
import collaborationController from '../controllers/collaborationController';

const router = Router();

// Virtual classroom
router.get('/classrooms', collaborationController.listClassrooms);
router.post('/classrooms', collaborationController.createClassroom);
router.get('/classrooms/:classroomId', collaborationController.getClassroom);
router.post('/classrooms/:classroomId/join', collaborationController.joinClassroom);
router.post('/classrooms/:classroomId/leave', collaborationController.leaveClassroom);
router.post('/classrooms/:classroomId/attendance', collaborationController.updateAttendance);
router.post('/classrooms/:classroomId/hand-raise', collaborationController.updateHandRaise);
router.post('/classrooms/:classroomId/queue/advance', collaborationController.advanceQueue);
router.patch('/classrooms/:classroomId/session', collaborationController.setSessionState);
router.patch('/classrooms/:classroomId/media-state', collaborationController.updateParticipantMediaState);
router.post('/classrooms/:classroomId/messages', collaborationController.addMessage);
router.post('/classrooms/:classroomId/files', collaborationController.shareFile);
router.post('/classrooms/:classroomId/whiteboard', collaborationController.addWhiteboardStroke);
router.post('/classrooms/:classroomId/polls', collaborationController.createPoll);
router.post('/classrooms/:classroomId/polls/:pollId/respond', collaborationController.respondToPoll);
router.post('/classrooms/:classroomId/breakout-rooms', collaborationController.createBreakoutRoom);
router.post('/classrooms/:classroomId/signals', collaborationController.enqueueSignal);
router.get('/classrooms/:classroomId/signals', collaborationController.pullSignals);
router.post('/classrooms/:classroomId/media-quality', collaborationController.reportMediaQuality);
router.post('/classrooms/:classroomId/interruptions', collaborationController.reportInterruption);
router.get('/classrooms/:classroomId/media-health', collaborationController.getMediaHealth);

// Collaborative learning workspaces
router.get('/workspaces', collaborationController.listWorkspaces);
router.post('/workspaces', collaborationController.createWorkspace);
router.get('/workspaces/:workspaceId', collaborationController.getWorkspace);
router.post('/workspaces/:workspaceId/documents/:documentId/sync', collaborationController.syncDocument);
router.post('/workspaces/:workspaceId/notes', collaborationController.addWorkspaceNote);
router.post('/workspaces/:workspaceId/discussions', collaborationController.addDiscussionPost);

// Peer review and study groups
router.get('/peer-review', collaborationController.listPeerReviews);
router.post('/peer-review', collaborationController.createPeerReview);
router.post('/peer-review/:assignmentId/submit', collaborationController.submitPeerReview);
router.get('/study-groups', collaborationController.listStudyGroups);
router.post('/study-groups', collaborationController.createStudyGroup);

export default router;
