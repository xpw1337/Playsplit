import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { SongInfo } from './youtubeUtils';

/**
 * Sends a batch of songs to Gemini 2.5 Flash and forces it to categorize
 * them into the provided list of approved categories.
 */
export async function classifySongsBatch(
    songsBatch: SongInfo[], 
    categories: string[], 
    apiKey: string
) {
    // 1. Initialize the provider with the user's custom API key
    const google = createGoogleGenerativeAI({ apiKey });
    const model = google('gemini-2.5-flash');

    // 2. Define the strict JSON schema we expect back
    const classificationSchema = z.object({
        results: z.array(z.object({
            videoId: z.string().describe("The exact YouTube videoId provided in the prompt"),
            category: z.string().describe(`Must be one of the following exact strings: ${categories.join(', ')}`)
        }))
    });

    // 3. Format the input data cleanly for the LLM
    const promptData = songsBatch.map(song => 
        `ID: ${song.videoId} | Title: ${song.title} | Desc: ${song.description.substring(0, 100)}...`
    ).join('\n');

    // 4. Call the Vercel AI SDK
    const { object } = await generateObject({
        model: model,
        schema: classificationSchema,
        prompt: `
            You are a music categorization assistant. 
            I have a list of YouTube videos (songs). Categorize each one into ONLY ONE of the following categories: [${categories.join(', ')}].
            If a song doesn't perfectly fit, make your best guess based on the title and description.
            
            Here are the songs:
            ${promptData}
        `
    });

    return object.results;
}