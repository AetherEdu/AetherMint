import { Request, Response, NextFunction } from 'express';
import holographicStorage from '../services/holographicStorage';
import { NotFoundError } from '../utils/errors';

export const encodeContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentId, data } = req.body;
    const buffer = Buffer.from(data, 'base64');
    const result = holographicStorage.encode(buffer, contentId);

    res.json({
      success: true,
      hash: result.hash,
      spatialPoints: result.points.length,
      message: 'Content encoded in holographic format'
    });
  } catch (error: any) {
    return next(error);
  }
};

export const decodeContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hash } = req.params;
    const data = holographicStorage.decode(hash);

    if (!data) {
      return next(new NotFoundError('Content not found'));
    }

    res.json({
      success: true,
      data: data.toString('base64'),
      size: data.length
    });
  } catch (error: any) {
    return next(error);
  }
};

export const parallelAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hashes } = req.body;
    const results = await holographicStorage.parallelAccess(hashes);

    res.json({
      success: true,
      data: results.map(r => r?.toString('base64')),
      count: results.length
    });
  } catch (error: any) {
    return next(error);
  }
};

export const getMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = holographicStorage.getMetrics();

    res.json({
      success: true,
      metrics: {
        storageDensity: `${(metrics.density * 100).toFixed(2)}%`,
        accessSpeed: `${metrics.accessSpeed.toFixed(0)} MB/s`,
        compressionRatio: `${metrics.compressionRatio.toFixed(2)}x`
      }
    });
  } catch (error: any) {
    return next(error);
  }
};

export const optimizeStorage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const beforeMetrics = holographicStorage.getMetrics();
    const afterMetrics = holographicStorage.optimizeDensity();

    res.json({
      success: true,
      optimization: {
        before: beforeMetrics,
        after: afterMetrics,
        improvement: `${((afterMetrics.density - beforeMetrics.density) * 100).toFixed(2)}%`
      }
    });
  } catch (error: any) {
    return next(error);
  }
};
