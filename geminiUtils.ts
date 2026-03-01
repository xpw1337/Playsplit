import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { SongInfo } from './youtubeUtils';

/**
 * Sends a sample of songs (e.g. 10) to Gemini and asks for exactly 3 category
 * names that would best split the playlist. Returns the 3 suggested category names.
 */
export async function suggestCategories(songs: SongInfo[], apiKey: string): Promise<string[]> {
    const google = createGoogleGenerativeAI({ apiKey });
    const model = google('gemini-2.5-flash');

    const schema = z.object({
        categories: z.array(z.string()).length(3).describe('Exactly 3 short category names (e.g. mood, genre, or activity) that would split this playlist well'),
    });

    const promptData = songs.map(song =>
        `Title: ${song.title} | ${song.description.substring(0, 120)}...`
    ).join('\n');

    const { object } = await generateObject({
        model,
        schema,
        prompt: `
You are a music playlist assistant. Below are up to 10 songs from a YouTube playlist (title and short description each).

Suggest exactly 3 category names that would work well to split this playlist into 3 sub-playlists. Categories should be distinct (e.g. by mood, energy, genre, or use case). Use short, clear names (1–3 words each).

Songs:
${promptData}

Return exactly 3 category names.
`,
    });

    return object.categories;
}

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