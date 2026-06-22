/**
 * @openapi
 * tags:
 *   - name: Assignments
 *     description: Assignment management and submission
 */

import { Router } from "express";
import { assignmentController } from "../controllers/assignmentController";

const router = Router();

/**
 * @openapi
 * /api/assignments:
 *   post:
 *     tags: [Assignments]
 *     summary: Create assignment
 *     responses:
 *       '200':
 *         description: Assignment created
 *   get:
 *     tags: [Assignments]
 *     summary: List all assignments
 *     responses:
 *       '200':
 *         description: Assignments listed
 */
router.post("/", assignmentController.createAssignment);
router.get("/", assignmentController.getAllAssignments);

/**
 * @openapi
 * /api/assignments/{assignmentId}:
 *   get:
 *     tags: [Assignments]
 *     summary: Get assignment by ID
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Assignment retrieved
 *   put:
 *     tags: [Assignments]
 *     summary: Update assignment
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Assignment updated
 *   delete:
 *     tags: [Assignments]
 *     summary: Delete assignment
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Assignment deleted
 */
router.get("/:assignmentId", assignmentController.getAssignmentById);
router.put("/:assignmentId", assignmentController.updateAssignment);
router.delete("/:assignmentId", assignmentController.deleteAssignment);

/**
 * @openapi
 * /api/assignments/{assignmentId}/submit:
 *   post:
 *     tags: [Assignments]
 *     summary: Submit assignment
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Assignment submitted
 */
router.post("/:assignmentId/submit", assignmentController.submitAssignment);

/**
 * @openapi
 * /api/assignments/{assignmentId}/grade:
 *   post:
 *     tags: [Assignments]
 *     summary: Grade assignment submission
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Assignment graded
 */
router.post("/:assignmentId/grade", assignmentController.gradeAssignment);

export default router;
