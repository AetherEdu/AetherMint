import { Router } from 'express';
import { forumService } from '../services/forum/forumService';
// import { authMiddleware } from '../middleware/auth'; // assume it exists

const router = Router();

router.get('/posts', async (req, res) => {
  try {
    const { courseId, page } = req.query;
    const posts = await forumService.getPosts(courseId as string, Number(page) || 1);
    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/posts', async (req, res) => {
  try {
    // req.user from authMiddleware
    const post = await forumService.createPost({ ...req.body, authorId: req.body.authorId || 'mock-user-id' });
    res.status(201).json(post);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/posts/:id/upvote', async (req, res) => {
  try {
    const post = await forumService.upvotePost(req.params.id);
    res.json(post);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/posts/:id/replies', async (req, res) => {
  try {
    const replies = await forumService.getReplies(req.params.id);
    res.json(replies);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/posts/:id/replies', async (req, res) => {
  try {
    const reply = await forumService.createReply({ ...req.body, postId: req.params.id });
    // Trigger notification here
    res.status(201).json(reply);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/posts/:id/replies/:replyId/accept', async (req, res) => {
  try {
    // mock user logic
    const userId = req.body.userId || 'mock-user-id';
    const isInstructor = req.body.isInstructor || false;
    const reply = await forumService.acceptAnswer(req.params.replyId, req.params.id, userId, isInstructor);
    res.json(reply);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
