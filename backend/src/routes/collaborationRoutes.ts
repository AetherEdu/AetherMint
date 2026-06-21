import express from 'express';
import { CollaborationRoomController } from '../controllers/collaborationRoomController';

const router: import('express').Router = express.Router();

// Room management routes
router.post('/rooms', CollaborationRoomController.createRoom);
router.get('/rooms', CollaborationRoomController.listRooms);
router.get('/rooms/:roomId', CollaborationRoomController.getRoomById);
router.post('/rooms/:roomId/end', CollaborationRoomController.endRoom);

export default router;
