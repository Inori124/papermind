import { chatCompletion } from './src/lib/llm';

async function main() {
  console.log('Testing DeepSeek API connection...');
  try {
    const result = await chatCompletion('You are a helpful assistant.', 'Say "Hello, PaperMind!" in exactly those words.');
    console.log('Response:', result);
    console.log('API connection successful!');
  } catch (error) {
    console.error('API connection failed:', error);
  }
}

main();
