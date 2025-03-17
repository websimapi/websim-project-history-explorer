// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('content');
    const projectTitle = document.getElementById('project-title');
    const authorName = document.getElementById('author-name');
    const authorAvatar = document.getElementById('author-avatar');
    const authorLink = document.getElementById('author-link');
    const projectDescription = document.getElementById('project-description');
    const currentThumbnail = document.getElementById('current-thumbnail');
    const versionsTimeline = document.getElementById('versions-timeline');
    const viewsCount = document.getElementById('views-count');
    const likesCount = document.getElementById('likes-count');
    const commentsCount = document.getElementById('comments-count');
    const projectLink = document.getElementById('project-link');
    const refreshBtn = document.getElementById('refresh-btn');

    // Function to format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Function to fetch and display a random project
    async function fetchRandomProject() {
        // Show loading, hide content
        loadingEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        versionsTimeline.innerHTML = '';

        try {
            // Fetch trending projects first
            const trendingResponse = await fetch('/api/v1/feed/trending?first=50');
            const trendingData = await trendingResponse.json();
            
            if (!trendingData.feed || !trendingData.feed.data || trendingData.feed.data.length === 0) {
                throw new Error('No trending projects found');
            }
            
            // Select a random project from the trending list
            const randomIndex = Math.floor(Math.random() * trendingData.feed.data.length);
            const randomProject = trendingData.feed.data[randomIndex];
            
            // Get the project ID
            const projectId = randomProject.project.id;
            
            // Fetch complete project details
            const projectResponse = await fetch(`/api/v1/projects/${projectId}`);
            const projectData = await projectResponse.json();
            
            // Fetch ALL project revisions with pagination handling
            let allRevisions = [];
            let hasMoreRevisions = true;
            let cursor = null;
            
            while (hasMoreRevisions) {
                const paginationParam = cursor ? `?after=${cursor}` : '';
                const revisionsResponse = await fetch(`/api/v1/projects/${projectId}/revisions${paginationParam}`);
                const revisionsData = await revisionsResponse.json();
                
                if (revisionsData.revisions.data.length > 0) {
                    allRevisions = [...allRevisions, ...revisionsData.revisions.data];
                    cursor = revisionsData.revisions.meta.end_cursor;
                    hasMoreRevisions = revisionsData.revisions.meta.has_next_page;
                } else {
                    hasMoreRevisions = false;
                }
            }
            
            // Update project info
            projectTitle.textContent = projectData.project.title || 'Untitled Project';
            authorName.textContent = `@${projectData.project.created_by.username}`;
            authorAvatar.src = projectData.project.created_by.avatar_url || 'https://images.websim.ai/avatar/default';
            authorLink.href = `https://websim.ai/@${projectData.project.created_by.username}`;
            projectDescription.textContent = projectData.project.description || 'No description available';
            
            // Set the current thumbnail
            const currentRevisionId = projectData.project_revision.id;
            currentThumbnail.src = projectData.project_revision.current_screenshot_url || '';
            
            // Update project stats
            viewsCount.textContent = projectData.project.stats.views.toLocaleString();
            likesCount.textContent = projectData.project.stats.likes.toLocaleString();
            commentsCount.textContent = projectData.project.stats.comments.toLocaleString();
            
            // Set project link
            projectLink.href = `https://websim.ai/p/${projectId}`;
            
            // Create and append version history items
            const sortedRevisions = allRevisions
                .map(item => item.project_revision)
                .sort((a, b) => a.version - b.version);
            
            for (const revision of sortedRevisions) {
                const versionItem = document.createElement('div');
                versionItem.className = 'version-item';
                
                const versionPromptText = revision.site_id && allRevisions.find(
                    item => item.project_revision.id === revision.id
                ).site ? 
                allRevisions.find(
                    item => item.project_revision.id === revision.id
                ).site.prompt?.text || 'No prompt available' : 'No prompt available';

                const promptType = revision.site_id && allRevisions.find(
                    item => item.project_revision.id === revision.id
                ).site ?
                allRevisions.find(
                    item => item.project_revision.id === revision.id
                ).site.prompt?.type || 'unknown' : 'unknown';
                
                versionItem.innerHTML = `
                    <div class="version-header">
                        <div>
                            <div class="version-number">Version ${revision.version}</div>
                            <div class="version-date">${formatDate(revision.created_at)}</div>
                        </div>
                        <img class="version-thumbnail" src="${revision.current_screenshot_url}" 
                             alt="Version ${revision.version} thumbnail"
                             onclick="window.open('https://websim.ai/p/${projectId}/v/${revision.version}', '_blank')">
                    </div>
                    <div class="version-prompt">
                        <h4>Prompt Type: ${promptType}</h4>
                        <div class="version-prompt-text">${versionPromptText}</div>
                    </div>
                `;
                
                versionsTimeline.appendChild(versionItem);
            }
            
            // Hide loading, show content
            loadingEl.classList.add('hidden');
            contentEl.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error fetching project data:', error);
            loadingEl.innerHTML = `
                <p>Failed to load project data. Please try again.</p>
                <button onclick="location.reload()" class="refresh-button">Retry</button>
            `;
        }
    }

    // Initial fetch
    fetchRandomProject();
    
    // Refresh button event listener
    refreshBtn.addEventListener('click', fetchRandomProject);
});