
import { createOpenAI } from '@ai-sdk/openai';

const doubao = createOpenAI(
    {
      apiKey: process.env.DOUBAO_API_KEY,
      baseURL: process.env.DOUBAO_BASE_URL,
    }
  )

  export default doubao;