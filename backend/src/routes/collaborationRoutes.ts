/**
 * @openapi
 * tags:
 *   - name: Collaboration
 *     description: Real-time collaboration room management
 *   - name: WhiteboardSessions
 *     description: Persisted whiteboard sessions (loading, saving, share links)
 */

import express from 'express';
import { CollaborationRoomController } from '../controllers/collaborationRoomController';
import { WhiteboardSessionController } from '../controllers/whiteboardSessionController';

const router: import('express').Router = express.Router();

/**
 * @openapi
 * /api/collaboration/rooms:
 *   post:
 *     tags: [Collaboration]
 *     summary: Create collaboration room
 *     responses:
 *       '200':
 *         description: Room created
 *   get:
 *     tags: [Collaboration]
 *     summary: List collaboration rooms
 *     responses:
 *       '200':
 *         description: Rooms listed
 */
router.post('/rooms', CollaborationRoomController.createRoom);
router.get('/rooms', CollaborationRoomController.listRooms);

/**
 * @openapi
 * /api/collaboration/rooms/{roomId}:
 *   get:
 *     tags: [Collaboration]
 *     summary: Get room by ID
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Room details
 */
router.get('/rooms/:roomId', CollaborationRoomController.getRoomById);

/**
 * @openapi
 * /api/collaboration/rooms/{roomId}/end:
 *   post:
 *     tags: [Collaboration]
 *     summary: End collaboration room
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Room ended
 */
router.post('/rooms/:roomId/end', CollaborationRoomController.endRoom);

// -----------------------------------------------------------------------------
// Whiteboard session persistence
//
// Issue #145 — these endpoints back the "Save / Load / Share" UX added to the
// real-time collaborative whiteboard. All paths live under
// /api/collaboration/whiteboard/* to keep them grouped with the rest of the
// collaboration surface.
// -----------------------------------------------------------------------------

/**
 * @openapi
 * /api/collaboration/whiteboard/sessions:
 *   get:
 *     tags: [WhiteboardSessions]
 *     summary: List the caller's whiteboard sessions (newest first).
 *   post:
 *     tags: [WhiteboardSessions]
 *     summary: Create a new whiteboard session.
 */
router.get('/whiteboard/sessions', WhiteboardSessionController.list);
router.post('/whiteboard/sessions', WhiteboardSessionController.create);

/**
 * @openapi
 * /api/collaboration/whiteboard/sessions/{id}:
 *   get:
 *     tags: [WhiteboardSessions]
 *     summary: Fetch a single session by id.
 *   put:
 *     tags: [WhiteboardSessions]
 *     summary: Save ops to an existing session (409 on version conflict).
 *   delete:
 *     tags: [WhiteboardSessions]
 *     summary: Delete a session owned by the caller.
 */
router.get('/whiteboard/sessions/:id', WhiteboardSessionController.getOne);
router.put('/whiteboard/sessions/:id', WhiteboardSessionController.saveOps);
router.delete('/whiteboard/sessions/:id', WhiteboardSessionController.delete);

/**
 * @openapi
 * /api/collaboration/whiteboard/sessions/{id}/share:
 *   post:
 *     tags: [WhiteboardSessions]
 *     summary: Mint or look up a read-only share token for a session.
 *   delete:
 *     tags: [WhiteboardSessions]
 *     summary: Revoke a previously issued share token.
 */
router.post('/whiteboard/sessions/:id/share', WhiteboardSessionController.createShare);
router.delete('/whiteboard/sessions/:id/share', WhiteboardSessionController.revokeShare);

/**
 * @openapi
 * /api/collaboration/whiteboard/shared:
 *   get:
 *     tags: [WhiteboardSessions]
 *     summary: Fetch a session using a share token (anonymous, read-only).
 */
router.get('/whiteboard/shared', WhiteboardSessionController.getByShare);

export default router;
