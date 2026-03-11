import { prisma } from '@/lib/prisma';
import { dbOperations } from "@/lib/db-error-wrapper";

// 单例
class Prompts {
    private prompts: Record<string, string> = {};

    get all() {
        return this.prompts;
    }

    private constructor(prompts: Record<string, string>) {
        this.prompts = prompts;
    }

    static async load() {
        const prompts = await dbOperations.findMany(async () => {
            return await prisma.dictionary.findMany()
        }, 'dictionary')

        const instance = new Prompts(prompts.reduce((acc, prompt) => {
            acc[prompt.key] = prompt.value;
            return acc;
        }, {} as Record<string, string>));

        return instance;
    }

    get(key: string): string {
        const prompt = this.prompts[key];

        if (!prompt) {
            throw new Error(`没有找到提示词: ${key}`);
        }

        return prompt;
    }
}


export default Prompts;

