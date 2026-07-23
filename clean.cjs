const fs = require('fs');
const file = 'd:/imich/valor/src/components/RemoteVideoPlayer.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { AudioSubPopover }')) {
    content = content.replace(
        /import React, \{ useState[^\n]+;\n/,
        match => match + "import { AudioSubPopover } from './AudioSubPopover';\n"
    );
}

content = content.replace(/\{resumePromptTime !== null.*?\}\)/s, '');
content = content.replace(/\{showAddDialog && \(\s*<BookmarkModal.*?\}\)/s, '');
content = content.replace(/\{showBookmarksPopover && \(\s*<BookmarkPanel.*?\}\)/s, '');
content = content.replace(/const handleDeleteBookmark = async.*?};/s, '');
content = content.replace(/useEffect\(\(\) => \{\s*const tmdbId = video\.tmdbId;.*?\}, \[video\.tmdbId, video\.id\]\);/s, '');

content = content.replace(/setResumePromptTime\([^)]*\);/g, '');
content = content.replace(/totalTimeWatchedRef\.current[^\n]*/g, '');
content = content.replace(/latestTimeRef\.current[^\n]*/g, '');
content = content.replace(/mountTimeRef\.current[^\n]*/g, '');
content = content.replace(/sessionStartRef\.current[^\n]*/g, '');
content = content.replace(/hadTidbDataRef\.current[^\n]*/g, '');

fs.writeFileSync(file, content);
console.log('Done');
