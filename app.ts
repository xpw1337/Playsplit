// --- DOM Elements ---
const ytApiKeyInput = document.getElementById('yt-api-key') as HTMLInputElement;
const geminiApiKeyInput = document.getElementById('gemini-api-key') as HTMLInputElement;
const playlistUrlInput = document.getElementById('playlist-url') as HTMLInputElement;
const customCategoriesInput = document.getElementById('custom-categories') as HTMLInputElement;

const processBtn = document.getElementById('process-btn') as HTMLButtonElement;
const suggestionBox = document.getElementById('suggestion-box') as HTMLDivElement;
const suggestedTagsDiv = document.getElementById('suggested-tags') as HTMLDivElement;
const approveCategoriesBtn = document.getElementById('approve-categories-btn') as HTMLButtonElement;
const rejectCategoriesBtn = document.getElementById('reject-categories-btn') as HTMLButtonElement;

const statusBox = document.getElementById('status-box') as HTMLDivElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
// ✅ New way (separates the Type from the Functions)
import { fetchAllPlaylistItems, extractPlaylistId, createPlaylist, addVideoToPlaylist } from './youtubeUtils.js';
import type { SongInfo } from './youtubeUtils.js';
import { classifySongsBatch } from './geminiUtils.js';
const oauthTokenInput = document.getElementById('oauth-token') as HTMLInputElement;
// --- State ---
let approvedCategories: string[] = [];

// --- Event Listeners ---
processBtn.addEventListener('click', handleProcessClick);
approveCategoriesBtn.addEventListener('click', proceedToSplit);
rejectCategoriesBtn.addEventListener('click', generateCategories);

// --- Core Functions ---

async function handleProcessClick() {
    const ytKey = ytApiKeyInput.value.trim();
    const geminiKey = geminiApiKeyInput.value.trim();
    const playlistId = playlistUrlInput.value.trim();
    const customCategories = customCategoriesInput.value.trim();

    if (!ytKey || !geminiKey || !playlistId) {
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

    try {
        // TODO: 1. Fetch a sample of song titles from the YouTube Playlist
        // TODO: 2. Send sample to Gemini API to suggest up to 5 categories

        // Mock response for testing UI
        setTimeout(() => {
            const mockSuggestions = ["High Energy", "Chill Vibes", "Melancholy", "Workout Focus"];
            approvedCategories = mockSuggestions;
            
            // Render suggested tags
            suggestedTagsDiv.innerHTML = '';
            mockSuggestions.forEach(cat => {
                const span = document.createElement('span');
                span.className = 'category-tag';
                span.innerText = cat;
                suggestedTagsDiv.appendChild(span);
            });
            updateStatus("Review the suggested categories.");
        }, 1500);

    } catch (error) {
        updateStatus(`Error: ${error}`);
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
