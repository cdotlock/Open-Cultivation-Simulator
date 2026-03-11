
import { createQwen } from 'qwen-ai-provider';

const qwen = createQwen(
    {
      apiKey: process.env.QWEN_API_KEY,
      baseURL: process.env.QWEN_BASE_URL,
    }
  )

  export default qwen;