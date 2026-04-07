import { Request as ExpressRequest } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string;
  role: string | string[]; // allow string array for RBAC
}

declare global {
  namespace Express {
    export interface Request {
      user: AuthenticatedUser;
      file?: any;
      files?: {
        avatar?: any;
        [key: string]: any;
      };
    }
  }
}

export type AuthenticatedRequest = ExpressRequest;
