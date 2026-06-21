import express, { Router } from "express";
import * as holographicController from "../controllers/holographicController";

const router: Router = express.Router();

router.post("/encode", holographicController.encodeContent);
router.get("/decode/:hash", holographicController.decodeContent);
router.post("/access/parallel", holographicController.parallelAccess);
router.get("/metrics", holographicController.getMetrics);
router.post("/optimize", holographicController.optimizeStorage);

export default router;
