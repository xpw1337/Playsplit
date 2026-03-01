import { fetchAllPlaylistItems, extractPlaylistId, createPlaylist, addVideoToPlaylist } from './youtubeUtils';
import type { SongInfo } from './youtubeUtils';
import { classifySongsBatch, suggestCategories } from './geminiUtils';

// --- DOM element refs (set when DOM is ready) ---
let ytApiKeyInput: HTMLInputElement;
let geminiApiKeyInput: HTMLInputElement;
let playlistUrlInput: HTMLInputElement;
let customCategoriesInput: HTMLInputElement;
let processBtn: HTMLButtonElement;
let suggestionBox: HTMLDivElement;
let suggestedTagsDiv: HTMLDivElement;
let approveCategoriesBtn: HTMLButtonElement;
let rejectCategoriesBtn: HTMLButtonElement;
let statusBox: HTMLDivElement;
let statusText: HTMLSpanElement;
let oauthTokenInput: HTMLInputElement;

// --- State ---
let approvedCategories: string[] = [];

function init() {
    ytApiKeyInput = document.getElementById('yt-api-key') as HTMLInputElement;
    geminiApiKeyInput = document.getElementById('gemini-api-key') as HTMLInputElement;
    playlistUrlInput = document.getElementById('playlist-url') as HTMLInputElement;
    customCategoriesInput = document.getElementById('custom-categories') as HTMLInputElement;
    processBtn = document.getElementById('process-btn') as HTMLButtonElement;
    suggestionBox = document.getElementById('suggestion-box') as HTMLDivElement;
    suggestedTagsDiv = document.getElementById('suggested-tags') as HTMLDivElement;
    approveCategoriesBtn = document.getElementById('approve-categories-btn') as HTMLButtonElement;
    rejectCategoriesBtn = document.getElementById('reject-categories-btn') as HTMLButtonElement;
    statusBox = document.getElementById('status-box') as HTMLDivElement;
    statusText = document.getElementById('status-text') as HTMLSpanElement;
    oauthTokenInput = document.getElementById('oauth-token') as HTMLInputElement;

    if (!processBtn || !statusBox || !statusText || !approveCategoriesBtn || !rejectCategoriesBtn) {
        console.error('Playsplit: required DOM elements not found. Check index.html.');
        return;
    }

    processBtn.type = 'button';
    processBtn.addEventListener('click', handleProcessClick);
    approveCategoriesBtn.addEventListener('click', proceedToSplit);
    rejectCategoriesBtn.addEventListener('click', generateCategories);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// --- Core Functions ---

async function handleProcessClick() {
    const ytKey = ytApiKeyInput.value.trim();
    const geminiKey = geminiApiKeyInput.value.trim();
    const playlistId = playlistUrlInput.value.trim();
    const customCategories = customCategoriesInput.value.trim();

    if (!ytKey || !geminiKey || !playlistId) {
        updateStatus("⚠️ Please fill in YouTube API Key, Gemini API Key, and Playlist URL/ID.");
        alert("Please provide both API keys and a Playlist URL/ID.");
        return;
    }

    if (customCategories === "") {
        // User left it blank, ask Gemini for suggestions
        updateStatus("Fetching playlist data to suggest categories...");
        await generateCategories();
    } else {
        // User provided custom categories
        approvedCategories = customCategories.split(',').map(c => c.trim()).filter(c => c);
        proceedToSplit();
    }
}

async function generateCategories() {
    suggestionBox.style.display = 'block';
    suggestedTagsDiv.innerHTML = '<em>Asking Gemini...</em>';
    processBtn.disabled = true;

    const ytKey = ytApiKeyInput.value.trim();
    const geminiKey = geminiApiKeyInput.value.trim();
    const rawPlaylistInput = playlistUrlInput.value.trim();

    try {
        const playlistId = extractPlaylistId(rawPlaylistInput);
        updateStatus("Fetching a sample of 10 songs from the playlist...");
        const allSongs = await fetchAllPlaylistItems(playlistId, ytKey);
        const sample = allSongs.slice(0, 10);
        if (sample.length === 0) {
            updateStatus("No songs found in that playlist.");
            processBtn.disabled = false;
            return;
        }
        suggestedTagsDiv.innerHTML = '<em>Asking Gemini for 3 categories...</em>';
        const suggestions = await suggestCategories(sample, geminiKey);
        approvedCategories = suggestions;

        suggestedTagsDiv.innerHTML = '';
        suggestions.forEach(cat => {
            const span = document.createElement('span');
            span.className = 'category-tag';
            span.innerText = cat;
            suggestedTagsDiv.appendChild(span);
        });
        updateStatus("Review the suggested categories.");
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        updateStatus(`Error: ${message}`);
    } finally {
        processBtn.disabled = false;
    }
}

async function proceedToSplit() {
    suggestionBox.style.display = 'none';
    processBtn.disabled = false;
    
    const ytKey = ytApiKeyInput.value.trim();
    const geminiKey = geminiApiKeyInput.value.trim();
    const oauthToken = oauthTokenInput.value.trim(); // Get the OAuth token
    const rawPlaylistInput = playlistUrlInput.value.trim();
    const playlistId = extractPlaylistId(rawPlaylistInput);
    
    if (!oauthToken) {
        alert("Please provide an OAuth Access Token to create playlists.");
        return;
    }

    try {
        // 1. Fetch
        updateStatus(`Fetching all songs from playlist...`);
        const allSongs = await fetchAllPlaylistItems(playlistId, ytKey);
        
        // 2. Classify (Batching Logic from previous step)
        const BATCH_SIZE = 50;
        const categorizedSongs: { videoId: string, category: string }[] = [];
        
        for (let i = 0; i < allSongs.length; i += BATCH_SIZE) {
            const batch = allSongs.slice(i, i + BATCH_SIZE);
            updateStatus(`Classifying batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(allSongs.length / BATCH_SIZE)}...`);
            const batchResults = await classifySongsBatch(batch, approvedCategories, geminiKey);
            categorizedSongs.push(...batchResults);
            await new Promise(resolve => setTimeout(resolve, 1000)); 
        }

        // 3. Group the results by category
        const groupedSongs: Record<string, string[]> = {};
        categorizedSongs.forEach(song => {
            const arr = groupedSongs[song.category];
            if (!arr) {
                groupedSongs[song.category] = [song.videoId];
            } else {
                arr.push(song.videoId);
            }
        });

        // 4. Create Playlists and Add Videos
        for (const category of Object.keys(groupedSongs)) {
            const videoIds = groupedSongs[category];
            if (!videoIds || videoIds.length === 0) continue;

            updateStatus(`Creating playlist for "${category}"...`);
            const newPlaylistId = await createPlaylist(category, oauthToken);

            let addedCount = 0;
            for (const videoId of videoIds) {
                updateStatus(`Adding to "${category}": ${addedCount + 1}/${videoIds.length} songs...`);
                await addVideoToPlaylist(newPlaylistId, videoId, oauthToken);
                
                // CRITICAL: 500ms delay to avoid YouTube API rate limits (HTTP 403/429)
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        updateStatus(`🎉 Success! All playlists created and populated. Check your YouTube Library.`);
        
    } catch (error: any) {
        updateStatus(`Error: ${error.message || error}`);
    }
}

function updateStatus(message: string) {
    statusBox.style.display = 'block';
    statusText.innerText = message;
}
