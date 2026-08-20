import { Post, IPost } from '../../models/Post';
import { Reply, IReply } from '../../models/Reply';

export class ForumService {
  async getPosts(courseId?: string, page = 1, limit = 20): Promise<IPost[]> {
    const query = courseId ? { courseId } : { courseId: { $exists: false } };
    return Post.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  async getPostById(postId: string): Promise<IPost | null> {
    return Post.findById(postId);
  }

  async createPost(data: Partial<IPost>): Promise<IPost> {
    const post = new Post(data);
    return post.save();
  }

  async upvotePost(postId: string): Promise<IPost | null> {
    return Post.findByIdAndUpdate(postId, { $inc: { upvotes: 1 } }, { new: true });
  }

  async getReplies(postId: string): Promise<IReply[]> {
    return Reply.find({ postId }).sort({ isAcceptedAnswer: -1, upvotes: -1, createdAt: 1 });
  }

  async createReply(data: Partial<IReply>): Promise<IReply> {
    const reply = new Reply(data);
    return reply.save();
  }

  async acceptAnswer(replyId: string, postId: string, userId: string, isInstructor: boolean): Promise<IReply | null> {
    const post = await Post.findById(postId);
    if (!post) throw new Error('Post not found');
    
    // Authorization logic should be in controller, but simplify here
    if (post.authorId !== userId && !isInstructor) {
      throw new Error('Not authorized to accept answer');
    }

    // Reset previous accepted answer
    await Reply.updateMany({ postId }, { isAcceptedAnswer: false });
    
    await Post.findByIdAndUpdate(postId, { isResolved: true });

    return Reply.findByIdAndUpdate(replyId, { isAcceptedAnswer: true }, { new: true });
  }
}

export const forumService = new ForumService();
