// src/types/express.d.ts
// Augment Express so req.user is recognized across your app.

import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      userId: string;
      email?: string;
      role?: string;
    };
  }
}

export {};

