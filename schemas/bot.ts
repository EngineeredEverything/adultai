import z from "zod";

export const botGenerationSchema = z.object({
    email: z.string().email(),
    password: z.string(),
    prompt: z.string(),
    count: z.number().min(1).max(10).default(1),
    width: z.number().min(64).max(2048).default(1024),
    height: z.number().min(64).max(2048).default(1024),
    modelId: z.string().default("flux"),
    steps: z.number().min(1).max(100).default(30),
    cfg: z.number().min(1).max(20).default(7.5),
    sampler: z.string().default("DPM++ 2M Karras"),
    seed: z.string().optional(),
    loraModel: z.string().optional(),
    loraStrength: z.number().min(0).max(2).optional(),
    enhanceStyle: z.string().optional(),
})