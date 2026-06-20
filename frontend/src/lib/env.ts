import { z } from 'zod';

const envSchema = z.object({
  // Required: Stellar receiver address for payments
  NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS: z
    .string()
    .min(56, 'Must be a valid Stellar public key (56 chars)')
    .max(56, 'Must be a valid Stellar public key (56 chars)')
    .regex(/^G[A-Z2-7]{55}$/, 'Must be a valid Stellar public key (starts with G)'),

  // Optional: Backend API base URL
  NEXT_PUBLIC_BACKEND_URL: z.string().url().optional(),

  // Optional: WebSocket server URL
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),

  // Optional: API URL for consciousness/general services
  NEXT_PUBLIC_API_URL: z.string().url().optional(),

  // Optional: API base URL for discovery/course API
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),

  // Optional: VAPID public key for push notifications
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),

  // Optional: Socket.IO server URL
  NEXT_PUBLIC_SOCKET_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS: process.env.NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  });

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`❌ Invalid environment variables:\n${errors}\n\nSee .env.example for reference.`);
  }

  return result.data;
}

export const env = validateEnv();
