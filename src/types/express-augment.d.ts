// src/types/express-augment.d.ts
//
// Express v5 uses @types/express v5, which re-exports Request from
// 'express-serve-static-core'. Augment that base module so all imports see it.

import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      userId: string;
      email?: string;
      role?: string;
      is_superadmin?: boolean;
    };
    org?: {
      orgId: string;
      role: 'owner' | 'admin' | 'member';
    };
  }
}

export {};
