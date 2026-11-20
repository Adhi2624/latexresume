import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Please provide a valid email');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200)
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/[0-9]/, 'Password needs a number');

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, 'Name is required').max(100),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });

export const createResumeSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  templateId: z.string().optional(),
  latexSource: z.string().max(500_000).optional(),
});

export const updateResumeSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  latexSource: z.string().max(500_000).optional(),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  ai: z
    .object({
      provider: z.enum(['openai', 'anthropic']),
      model: z.string().trim().max(100).optional().default(''),
      baseURL: z.union([z.string().trim().url().refine((u) => /^https?:\/\//i.test(u), 'Base URL must start with http:// or https://'), z.literal('')]).optional(),
      apiKey: z.string().trim().max(500).optional(), // empty/undefined = keep existing
      clearKey: z.boolean().optional(),
    })
    .optional(),
});
