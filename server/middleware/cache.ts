import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to set HTTP Cache-Control headers for referential/static data.
 * @param maxAgeInSeconds Time in seconds to cache the response.
 */
export const setHttpCache = (maxAgeInSeconds: number = 3600) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method === 'GET') {
            res.setHeader('Cache-Control', `public, max-age=${maxAgeInSeconds}`);
        } else {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        }
        next();
    };
};
