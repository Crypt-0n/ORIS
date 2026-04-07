import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Express middleware to validate request body, query, or params against a Zod schema.
 * @param schema Zod schema to validate against
 * @param target 'body' | 'query' | 'params' - Part of the request to validate
 */
export const validateRequest = (schema: ZodSchema<any>, target: 'body' | 'query' | 'params' = 'body') => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate the data
            const validatedData = schema.parse(req[target]);
            // Replace request data with parsed data (strips unknown fields if .strip() is used in schema)
            req[target] = validatedData;
            next();
        } catch (error: any) {
            if (error instanceof ZodError || error?.name === 'ZodError') {
                const issues = error.issues || error.errors || [];
                // Format Zod errors into a readable structure
                const formattedErrors = issues.map((err: any) => ({
                    field: err.path ? err.path.join('.') : 'root',
                    message: err.message,
                }));
                return res.status(400).json({
                    error: 'Validation failed',
                    details: formattedErrors,
                });
            }
            console.error('validateRequest 500 fallback:', error);
            return res.status(500).json({ error: 'Internal server error during validation' });
        }
    };
};
