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
    const searchForm = document.getElementById('search-form');
    const usernameInput = document.getElementById('username-input');
    const searchContainer = document.getElementById('search-container');
    const userProjectsContainer = document.getElementById('user-projects');
    const projectDetailsContainer = document.getElementById('project-details');
    const userHeading = document.getElementById('user-heading');
    const backToProjectsBtn = document.getElementById('back-to-projects');

    // App state
    let currentUser = null;
    let currentView = 'search'; // 'search', 'projects', 'details'
    let projectsEndCursor = null;
    let hasNextPage = false;
    let isLoadingMore = false;
    let slideshowIntervals = {}; // Store intervals for each project card

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

    // Function to handle image slideshow for project cards
    function startSlideshow(projectCard, projectId) {
        if (slideshowIntervals[projectId]) return; // Already running
        
        const thumbnail = projectCard.querySelector('.project-card-thumbnail');
        const originalSrc = thumbnail.src;
        const projectData = projectCard.projectData;
        
        if (!projectData || !projectData.revisions || projectData.revisions.length <= 1) return;
        
        let currentIndex = 0;
        const revisions = projectData.revisions;
        
        slideshowIntervals[projectId] = setInterval(() => {
            currentIndex = (currentIndex + 1) % revisions.length;
            const newSrc = revisions[currentIndex].current_screenshot_url;
            
            // Only change if the image is valid
            const img = new Image();
            img.onload = function() {
                thumbnail.src = newSrc;
            };
            img.onerror = function() {
                // Skip failed images
                currentIndex = (currentIndex + 1) % revisions.length;
                thumbnail.src = revisions[currentIndex].current_screenshot_url || originalSrc;
            };
            img.src = newSrc;
        }, 1000);
    }

    function stopSlideshow(projectId) {
        if (slideshowIntervals[projectId]) {
            clearInterval(slideshowIntervals[projectId]);
            delete slideshowIntervals[projectId];
        }
    }

    // Function to switch between views
    function switchView(view) {
        currentView = view;
        
        // Hide all containers first
        searchContainer.classList.add('hidden');
        userProjectsContainer.classList.add('hidden');
        projectDetailsContainer.classList.add('hidden');
        
        // Show appropriate container based on view
        if (view === 'search') {
            searchContainer.classList.remove('hidden');
        } else if (view === 'projects') {
            userProjectsContainer.classList.remove('hidden');
        } else if (view === 'details') {
            projectDetailsContainer.classList.remove('hidden');
        }
    }

    // Function to fetch user projects
    async function fetchUserProjects(username, afterCursor = null, reset = true) {
        if (reset) {
            loadingEl.classList.remove('hidden');
            projectsEndCursor = null;
            hasNextPage = false;
        } else {
            // Add loading indicator at the bottom
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'infinite-scroll-loader';
            loadingIndicator.innerHTML = `
                <svg width="30" height="30" viewBox="0 0 50 50">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="#3498db" stroke-width="4"></circle>
                    <circle cx="25" cy="25" r="20" fill="none" stroke="#f3f3f3" stroke-width="4" 
                           stroke-dasharray="125.6" stroke-dashoffset="125.6" class="loader-circle"></circle>
                </svg>
            `;
            userProjectsContainer.appendChild(loadingIndicator);
        }
        
        isLoadingMore = true;
        
        try {
            // Fetch user info first to validate the username (only on first load)
            if (reset) {
                const userResponse = await fetch(`/api/v1/users/${username}`);
                if (!userResponse.ok) {
                    throw new Error('User not found');
                }
                
                const userData = await userResponse.json();
                currentUser = userData.user;
                
                // Update UI with user info
                userHeading.innerHTML = `
                    <img src="${currentUser.avatar_url || 'https://images.websim.ai/avatar/default'}" alt="${currentUser.username}'s avatar">
                    <h2>@${currentUser.username}'s Projects</h2>
                `;
                
                // Clear container if reset
                userProjectsContainer.innerHTML = '';
                // Re-add the heading
                userProjectsContainer.appendChild(userHeading);
            }
            
            // Fetch user's projects with pagination
            const paginationParam = afterCursor ? `&after=${afterCursor}` : '';
            const projectsResponse = await fetch(`/api/v1/users/${username}/projects?first=20${paginationParam}`);
            const projectsData = await projectsResponse.json();
            
            // Update pagination state
            projectsEndCursor = projectsData.projects.meta.end_cursor;
            hasNextPage = projectsData.projects.meta.has_next_page;
            
            // Remove loading indicator if not the first load
            if (!reset) {
                const loadingIndicator = userProjectsContainer.querySelector('.infinite-scroll-loader');
                if (loadingIndicator) {
                    loadingIndicator.remove();
                }
            }
            
            // Create project cards
            if (projectsData.projects.data.length === 0 && reset) {
                const noProjectsDiv = document.createElement('div');
                noProjectsDiv.className = 'no-projects';
                noProjectsDiv.textContent = 'No public projects found for this user';
                userProjectsContainer.appendChild(noProjectsDiv);
            } else {
                for (const item of projectsData.projects.data) {
                    const project = item.project;
                    const projectCard = document.createElement('div');
                    projectCard.className = 'project-card';
                    projectCard.dataset.projectId = project.id;
                    
                    projectCard.innerHTML = `
                        <img class="project-card-thumbnail" src="${item.project_revision.current_screenshot_url}" alt="${project.title || 'Untitled Project'}">
                        <div class="project-card-info">
                            <div class="project-card-title">${project.title || 'Untitled Project'}</div>
                            <div class="project-card-date">${formatDate(project.created_at)}</div>
                        </div>
                    `;
                    
                    // Fetch all revisions for this project to enable slideshow
                    fetchProjectRevisions(project.id).then(revisions => {
                        projectCard.projectData = { revisions };
                        
                        // Add hover events for slideshow
                        projectCard.addEventListener('mouseenter', () => {
                            startSlideshow(projectCard, project.id);
                        });
                        
                        projectCard.addEventListener('mouseleave', () => {
                            stopSlideshow(project.id);
                            // Reset to original thumbnail
                            const thumbnail = projectCard.querySelector('.project-card-thumbnail');
                            thumbnail.src = item.project_revision.current_screenshot_url;
                        });
                    });
                    
                    projectCard.addEventListener('click', () => {
                        fetchProjectDetails(project.id);
                    });
                    
                    userProjectsContainer.appendChild(projectCard);
                }
                
                // Show "no more results" if we've reached the end
                if (!hasNextPage && !reset) {
                    const endMessage = document.createElement('div');
                    endMessage.className = 'infinite-scroll-complete';
                    endMessage.textContent = 'No more projects to load';
                    userProjectsContainer.appendChild(endMessage);
                }
            }
            
            // Switch to projects view if this is initial load
            if (reset) {
                switchView('projects');
            }
            
        } catch (error) {
            console.error('Error fetching user data:', error);
            
            if (reset) {
                userProjectsContainer.innerHTML = `
                    <div class="no-projects">
                        <p>Error: ${error.message}</p>
                        <button onclick="location.reload()" class="refresh-button">Try Again</button>
                    </div>
                `;
                switchView('projects');
            } else {
                // Show error at the bottom for infinite scroll
                const loadingIndicator = userProjectsContainer.querySelector('.infinite-scroll-loader');
                if (loadingIndicator) {
                    loadingIndicator.remove();
                }
                
                const errorMessage = document.createElement('div');
                errorMessage.className = 'infinite-scroll-complete';
                errorMessage.textContent = `Error loading more projects: ${error.message}`;
                userProjectsContainer.appendChild(errorMessage);
            }
        } finally {
            if (reset) {
                loadingEl.classList.add('hidden');
            }
            isLoadingMore = false;
        }
    }

    // Helper function to fetch all revisions for a project
    async function fetchProjectRevisions(projectId) {
        try {
            let allRevisions = [];
            let hasMoreRevisions = true;
            let cursor = null;
            
            while (hasMoreRevisions) {
                const paginationParam = cursor ? `?after=${cursor}` : '';
                const revisionsResponse = await fetch(`/api/v1/projects/${projectId}/revisions${paginationParam}`);
                const revisionsData = await revisionsResponse.json();
                
                if (revisionsData.revisions.data.length > 0) {
                    allRevisions = [...allRevisions, ...revisionsData.revisions.data.map(item => item.project_revision)];
                    cursor = revisionsData.revisions.meta.end_cursor;
                    hasMoreRevisions = revisionsData.revisions.meta.has_next_page;
                } else {
                    hasMoreRevisions = false;
                }
            }
            
            return allRevisions;
        } catch (error) {
            console.error('Error fetching revisions:', error);
            return [];
        }
    }

    // Function to fetch and display a project's details
    async function fetchProjectDetails(projectId) {
        // Show loading, hide content
        loadingEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        versionsTimeline.innerHTML = '';

        try {
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
            
            // Switch to project details view
            switchView('details');
            
        } catch (error) {
            console.error('Error fetching project data:', error);
            loadingEl.innerHTML = `
                <p>Failed to load project data. Please try again.</p>
                <button onclick="location.reload()" class="refresh-button">Retry</button>
            `;
        }
    }

    // Random project fetch (for the refresh button)
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
            
            // Get the project ID and fetch details
            const projectId = randomProject.project.id;
            await fetchProjectDetails(projectId);
            
        } catch (error) {
            console.error('Error fetching random project:', error);
            loadingEl.innerHTML = `
                <p>Failed to load project data. Please try again.</p>
                <button onclick="location.reload()" class="refresh-button">Retry</button>
            `;
        }
    }

    // Infinite scroll handler
    function handleScroll() {
        if (currentView !== 'projects' || isLoadingMore || !hasNextPage) return;
        
        const scrollPosition = window.innerHeight + window.scrollY;
        const contentHeight = document.body.offsetHeight;
        
        // Load more when user scrolls near the bottom (200px threshold)
        if (contentHeight - scrollPosition < 200 && currentUser) {
            fetchUserProjects(currentUser.username, projectsEndCursor, false);
        }
    }

    // Event Listeners
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        if (username) {
            fetchUserProjects(username);
        }
    });
    
    backToProjectsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('projects');
    });
    
    refreshBtn.addEventListener('click', fetchRandomProject);
    
    // Add scroll event listener for infinite scrolling
    window.addEventListener('scroll', handleScroll);

    // Clean up all slideshows when leaving the page
    window.addEventListener('beforeunload', () => {
        Object.keys(slideshowIntervals).forEach(id => {
            clearInterval(slideshowIntervals[id]);
        });
    });

    // Initial view
    switchView('search');
});