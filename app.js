// Global Application State
const state = {
    metadata: { leagues: [], teams: [], team_display: {}, league_display: {} },
    matches: [],
    filteredMatches: [],
    
    // Search Criteria
    searchClub: "",
    searchDate: "",
    searchComp: "",

    // Pagination
    currentPage: 1,
    pageSize: 20,

    // UI state
    highlightedSuggestIdx: -1
};

// DOM Elements
const elements = {
    clubInput: document.getElementById("club-input"),
    clubSuggestions: document.getElementById("club-suggestions"),
    clearClub: document.getElementById("clear-club"),
    
    dateInput: document.getElementById("date-input"),
    
    compInput: document.getElementById("comp-input"),
    compSuggestions: document.getElementById("comp-suggestions"),
    clearComp: document.getElementById("clear-comp"),
    
    resetFilters: document.getElementById("reset-filters"),
    searchForm: document.getElementById("search-form"),
    
    resultsCount: document.getElementById("results-count"),
    activeFiltersTags: document.getElementById("active-filters-tags"),
    matchesList: document.getElementById("matches-list"),
    
    pagination: document.getElementById("pagination"),
    prevPage: document.getElementById("prev-page"),
    nextPage: document.getElementById("next-page"),
    pageIndicator: document.getElementById("page-indicator"),
    
    detailOverlay: document.getElementById("detail-overlay"),
    detailDrawer: document.getElementById("detail-drawer"),
    closeDrawer: document.getElementById("close-drawer"),
    drawerContent: document.getElementById("drawer-content")
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    loadMetadata();
    loadMatchesIndex();
    setupEventListeners();
});

// Load Metadata for autocomplete (small file)
async function loadMetadata() {
    try {
        const response = await fetch("web_data/metadata.json");
        if (!response.ok) throw new Error("Failed to load metadata");
        state.metadata = await response.json();
    } catch (error) {
        console.error("Error loading metadata:", error);
    }
}

// Load large search index asynchronously in background
async function loadMatchesIndex() {
    try {
        const response = await fetch("web_data/matches_index.json");
        if (!response.ok) throw new Error("Failed to load match database");
        state.matches = await response.json();
        
        // Initial clean state, do not show 65,000 matches immediately
        state.filteredMatches = [];
        renderResults();
    } catch (error) {
        console.error("Error loading match index:", error);
        elements.resultsCount.innerText = "Error loading database.";
    }
}

// Set up all interactive event listeners
function setupEventListeners() {
    // Club Input Autocomplete
    elements.clubInput.addEventListener("input", (e) => {
        const value = e.target.value.trim().toLowerCase();
        toggleClearButton(elements.clearClub, value.length > 0);
        if (value.length >= 2) {
            showTeamSuggestions(value);
        } else {
            closeSuggestions(elements.clubSuggestions);
        }
    });

    elements.clubInput.addEventListener("focus", () => {
        const value = elements.clubInput.value.trim().toLowerCase();
        if (value.length >= 2) showTeamSuggestions(value);
    });

    elements.clearClub.addEventListener("click", () => {
        elements.clubInput.value = "";
        toggleClearButton(elements.clearClub, false);
        closeSuggestions(elements.clubSuggestions);
        state.searchClub = "";
        updateSearchFilters();
    });

    // Competition Input Autocomplete
    elements.compInput.addEventListener("input", (e) => {
        const value = e.target.value.trim().toLowerCase();
        toggleClearButton(elements.clearComp, value.length > 0);
        if (value.length >= 2) {
            showCompSuggestions(value);
        } else {
            closeSuggestions(elements.compSuggestions);
        }
    });

    elements.compInput.addEventListener("focus", () => {
        const value = elements.compInput.value.trim().toLowerCase();
        if (value.length >= 2) showCompSuggestions(value);
    });

    elements.clearComp.addEventListener("click", () => {
        elements.compInput.value = "";
        toggleClearButton(elements.clearComp, false);
        closeSuggestions(elements.compSuggestions);
        state.searchComp = "";
        updateSearchFilters();
    });

    // Handle clicking outside suggestions to close them
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#club-group")) closeSuggestions(elements.clubSuggestions);
        if (!e.target.closest("#comp-group")) closeSuggestions(elements.compSuggestions);
    });

    // Date change handler
    elements.dateInput.addEventListener("change", (e) => {
        state.searchDate = e.target.value;
        updateSearchFilters();
    });

    // Form submission triggers search
    elements.searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        triggerSearch();
    });

    // Reset Filters button
    elements.resetFilters.addEventListener("click", () => {
        elements.clubInput.value = "";
        elements.dateInput.value = "";
        elements.compInput.value = "";
        toggleClearButton(elements.clearClub, false);
        toggleClearButton(elements.clearComp, false);
        closeSuggestions(elements.clubSuggestions);
        closeSuggestions(elements.compSuggestions);
        
        state.searchClub = "";
        state.searchDate = "";
        state.searchComp = "";
        state.filteredMatches = [];
        state.currentPage = 1;
        
        renderResults();
    });

    // Pagination Events
    elements.prevPage.addEventListener("click", () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderResultsList();
            scrollToResults();
        }
    });

    elements.nextPage.addEventListener("click", () => {
        const totalPages = Math.ceil(state.filteredMatches.length / state.pageSize);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            renderResultsList();
            scrollToResults();
        }
    });

    // Drawer closing
    elements.closeDrawer.addEventListener("click", closeMatchDrawer);
    elements.detailOverlay.addEventListener("click", closeMatchDrawer);

    // Keyboard navigation support inside inputs for suggestions dropdowns
    setupKeyboardNavigation(elements.clubInput, elements.clubSuggestions, (val) => {
        elements.clubInput.value = getDisplayTeam(val);
        state.searchClub = val;
        toggleClearButton(elements.clearClub, true);
        updateSearchFilters();
    });

    setupKeyboardNavigation(elements.compInput, elements.compSuggestions, (val) => {
        elements.compInput.value = getDisplayLeague(val);
        state.searchComp = val;
        toggleClearButton(elements.clearComp, true);
        updateSearchFilters();
    });
}

// Enable standard keyboard scrolling / selecting inside suggestion boxes
function setupKeyboardNavigation(inputEl, dropdownEl, onSelect) {
    inputEl.addEventListener("keydown", (e) => {
        const items = dropdownEl.querySelectorAll(".suggestion-item");
        if (!items.length || dropdownEl.classList.contains("hidden")) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            state.highlightedSuggestIdx = (state.highlightedSuggestIdx + 1) % items.length;
            highlightSuggestion(items);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            state.highlightedSuggestIdx = (state.highlightedSuggestIdx - 1 + items.length) % items.length;
            highlightSuggestion(items);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (state.highlightedSuggestIdx >= 0 && state.highlightedSuggestIdx < items.length) {
                const selectedVal = items[state.highlightedSuggestIdx].getAttribute("data-value");
                onSelect(selectedVal);
                closeSuggestions(dropdownEl);
            }
        } else if (e.key === "Escape") {
            closeSuggestions(dropdownEl);
        }
    });
}

function highlightSuggestion(items) {
    items.forEach((item, idx) => {
        if (idx === state.highlightedSuggestIdx) {
            item.classList.add("highlighted");
            item.scrollIntoView({ block: "nearest" });
        } else {
            item.classList.remove("highlighted");
        }
    });
}

// Helpers for displaying pretty names
function getDisplayTeam(slug) {
    return state.metadata.team_display[slug] || slug;
}

function getDisplayLeague(slug) {
    return state.metadata.league_display[slug] || slug;
}

// Manage Clear Buttons visibility
function toggleClearButton(btnEl, isVisible) {
    if (isVisible) {
        btnEl.classList.add("visible");
    } else {
        btnEl.classList.remove("visible");
    }
}

function closeSuggestions(dropdownEl) {
    dropdownEl.classList.add("hidden");
    dropdownEl.innerHTML = "";
    state.highlightedSuggestIdx = -1;
}

// Autocomplete filter matching for Teams
function showTeamSuggestions(query) {
    const matched = state.metadata.teams.filter(t => 
        t.toLowerCase().includes(query) || 
        getDisplayTeam(t).toLowerCase().includes(query)
    ).slice(0, 10);

    renderSuggestions(elements.clubSuggestions, matched, getDisplayTeam);
}

// Autocomplete filter matching for Competitions
function showCompSuggestions(query) {
    const matched = state.metadata.leagues.filter(l => 
        l.toLowerCase().includes(query) || 
        getDisplayLeague(l).toLowerCase().includes(query)
    ).slice(0, 10);

    renderSuggestions(elements.compSuggestions, matched, getDisplayLeague);
}

// Render Suggestions in Dropdowns
function renderSuggestions(dropdownEl, items, displayFn) {
    if (!items.length) {
        closeSuggestions(dropdownEl);
        return;
    }

    dropdownEl.innerHTML = items.map((val, idx) => `
        <div class="suggestion-item" data-value="${val}">${displayFn(val)}</div>
    `).join("");

    dropdownEl.classList.remove("hidden");
    state.highlightedSuggestIdx = -1;

    // Attach click events
    dropdownEl.querySelectorAll(".suggestion-item").forEach(item => {
        item.addEventListener("click", () => {
            const val = item.getAttribute("data-value");
            const inputEl = dropdownEl.id === "club-suggestions" ? elements.clubInput : elements.compInput;
            const clearEl = dropdownEl.id === "club-suggestions" ? elements.clearClub : elements.clearComp;
            
            inputEl.value = displayFn(val);
            toggleClearButton(clearEl, true);
            
            if (dropdownEl.id === "club-suggestions") {
                state.searchClub = val;
            } else {
                state.searchComp = val;
            }
            
            closeSuggestions(dropdownEl);
            updateSearchFilters();
        });
    });
}

// Filter updating logic
function updateSearchFilters() {
    // Collect criteria directly from text inputs if they don't match autocomplete items directly
    const rawClub = elements.clubInput.value.trim().toLowerCase();
    if (!rawClub) state.searchClub = "";
    else if (!state.searchClub || getDisplayTeam(state.searchClub).toLowerCase() !== rawClub) {
        // Fallback to text match if user types custom name
        state.searchClub = rawClub;
    }

    const rawComp = elements.compInput.value.trim().toLowerCase();
    if (!rawComp) state.searchComp = "";
    else if (!state.searchComp || getDisplayLeague(state.searchComp).toLowerCase() !== rawComp) {
        state.searchComp = rawComp;
    }

    triggerSearch();
}

// Core Search Execution inside state.matches
function triggerSearch() {
    if (!state.matches.length) return; // Database not loaded yet
    
    // If all filters are blank, show prompt to search
    if (!state.searchClub && !state.searchDate && !state.searchComp) {
        state.filteredMatches = [];
        state.currentPage = 1;
        renderResults();
        return;
    }

    state.filteredMatches = state.matches.filter(match => {
        // Club name match (can match home or away)
        if (state.searchClub) {
            const homeMatches = match.h.toLowerCase().includes(state.searchClub.toLowerCase()) || 
                                getDisplayTeam(match.h).toLowerCase().includes(state.searchClub.toLowerCase());
            const awayMatches = match.a.toLowerCase().includes(state.searchClub.toLowerCase()) || 
                                getDisplayTeam(match.a).toLowerCase().includes(state.searchClub.toLowerCase());
            if (!homeMatches && !awayMatches) return false;
        }

        // Date match (exact prefix YYYY-MM-DD or parts)
        if (state.searchDate && match.d !== state.searchDate) {
            return false;
        }

        // Competition/league match
        if (state.searchComp) {
            const compMatches = match.l.toLowerCase().includes(state.searchComp.toLowerCase()) || 
                                getDisplayLeague(match.l).toLowerCase().includes(state.searchComp.toLowerCase());
            if (!compMatches) return false;
        }

        return true;
    });

    // Sort matching dates in descending order (recent matches first)
    state.filteredMatches.sort((x, y) => y.d.localeCompare(x.d));

    state.currentPage = 1;
    renderResults();
}

// Render Results Wrapper
function renderResults() {
    renderFilterTags();
    renderResultsList();
}

// Render selected filters as removable chips
function renderFilterTags() {
    elements.activeFiltersTags.innerHTML = "";
    
    if (state.searchClub) {
        addFilterTag(getDisplayTeam(state.searchClub), () => {
            elements.clubInput.value = "";
            toggleClearButton(elements.clearClub, false);
            state.searchClub = "";
            updateSearchFilters();
        });
    }
    
    if (state.searchDate) {
        addFilterTag(state.searchDate, () => {
            elements.dateInput.value = "";
            state.searchDate = "";
            updateSearchFilters();
        });
    }
    
    if (state.searchComp) {
        addFilterTag(getDisplayLeague(state.searchComp), () => {
            elements.compInput.value = "";
            toggleClearButton(elements.clearComp, false);
            state.searchComp = "";
            updateSearchFilters();
        });
    }
}

function addFilterTag(text, onRemove) {
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `
        <span>${text}</span>
        <span class="tag-remove">&times;</span>
    `;
    tag.querySelector(".tag-remove").addEventListener("click", onRemove);
    elements.activeFiltersTags.appendChild(tag);
}

// Render Paginated Results List
function renderResultsList() {
    const listEl = elements.matchesList;
    listEl.innerHTML = "";

    // Empty database state
    if (!state.matches.length) {
        listEl.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
        elements.resultsCount.innerText = "Loading match index...";
        elements.pagination.classList.add("hidden");
        return;
    }

    // Default start state (no search entered yet)
    if (!state.searchClub && !state.searchDate && !state.searchComp) {
        listEl.innerHTML = `
            <div class="no-results-state">
                <p>Enter a club name, select a date, or competition to begin searching.</p>
            </div>
        `;
        elements.resultsCount.innerText = `Total available matches: ${state.matches.length.toLocaleString()}`;
        elements.pagination.classList.add("hidden");
        return;
    }

    // No search results state
    if (!state.filteredMatches.length) {
        listEl.innerHTML = `
            <div class="no-results-state">
                <p>No matches found matching the criteria.</p>
            </div>
        `;
        elements.resultsCount.innerText = "Found 0 matches";
        elements.pagination.classList.add("hidden");
        return;
    }

    const totalMatches = state.filteredMatches.length;
    elements.resultsCount.innerText = `Found ${totalMatches.toLocaleString()} match${totalMatches === 1 ? "" : "es"}`;

    // Slice list for pagination
    const startIdx = (state.currentPage - 1) * state.pageSize;
    const endIdx = Math.min(startIdx + state.pageSize, totalMatches);
    const paginatedItems = state.filteredMatches.slice(startIdx, endIdx);

    // Build list
    paginatedItems.forEach(match => {
        const card = document.createElement("div");
        card.className = "match-card animate-fade-in";
        
        // Highlight winner
        const homeWinner = match.gh > match.ga;
        const awayWinner = match.ga > match.gh;

        card.innerHTML = `
            <div class="match-comp">${getDisplayLeague(match.l)}</div>
            <div class="match-teams-score">
                <div class="team-row ${homeWinner ? "winner" : ""}">
                    <span>${getDisplayTeam(match.h)}</span>
                    <span class="team-score">${match.gh}</span>
                </div>
                <div class="team-row ${awayWinner ? "winner" : ""}">
                    <span>${getDisplayTeam(match.a)}</span>
                    <span class="team-score">${match.ga}</span>
                </div>
            </div>
            <div class="match-footer">
                <div class="match-date">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span>${formatDate(match.d)}</span>
                </div>
                <span>View Details &rarr;</span>
            </div>
        `;

        card.addEventListener("click", () => openMatchDrawer(match));
        listEl.appendChild(card);
    });

    // Update pagination controls
    const totalPages = Math.ceil(totalMatches / state.pageSize);
    if (totalPages > 1) {
        elements.pagination.classList.remove("hidden");
        elements.pageIndicator.innerText = `Page ${state.currentPage} of ${totalPages}`;
        elements.prevPage.disabled = state.currentPage === 1;
        elements.nextPage.disabled = state.currentPage === totalPages;
    } else {
        elements.pagination.classList.add("hidden");
    }
}

// Format date nicely (e.g. May 19, 2024)
function formatDate(dateString) {
    if (!dateString) return "";
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', options);
}

function scrollToResults() {
    elements.resultsCount.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Sliding Drawer Details Pane
function openMatchDrawer(matchMeta) {
    elements.detailOverlay.classList.remove("hidden");
    elements.detailDrawer.classList.remove("hidden");
    document.body.style.overflow = "hidden"; // Lock page scroll

    // Show initial skeleton loader
    elements.drawerContent.innerHTML = `
        <div class="detail-header">
            <div class="detail-header-comp">${getDisplayLeague(matchMeta.l)}</div>
            <div class="detail-header-date">${formatDate(matchMeta.d)}</div>
            <div class="detail-score-board">
                <div class="score-team-name">${getDisplayTeam(matchMeta.h)}</div>
                <div class="score-display">${matchMeta.gh} - ${matchMeta.ga}</div>
                <div class="score-team-name">${getDisplayTeam(matchMeta.a)}</div>
            </div>
        </div>
        <div class="skeleton-card" style="height: 150px;"></div>
        <div class="skeleton-card" style="height: 80px;"></div>
    `;

    // Fetch full incidents on demand
    fetchIncidentDetails(matchMeta);
}

function closeMatchDrawer() {
    elements.detailOverlay.classList.add("hidden");
    elements.detailDrawer.classList.add("hidden");
    document.body.style.overflow = ""; // Restore page scroll
}

// Fetch match incident details on-demand from lazy files
async function fetchIncidentDetails(matchMeta) {
    try {
        const response = await fetch(`data/goals_time2/${matchMeta.f}`);
        if (!response.ok) throw new Error("Could not load match details");
        
        const fullLeagueMatches = await response.json();
        const matchDetails = fullLeagueMatches[matchMeta.i];
        
        if (matchDetails) {
            renderMatchDetails(matchMeta, matchDetails);
        } else {
            throw new Error("Match index mismatch");
        }
    } catch (error) {
        console.error("Error loading incidents:", error);
        elements.drawerContent.innerHTML += `
            <div style="padding: 1.5rem; text-align: center; color: var(--danger-color); font-size: 0.9rem;">
                Failed to load match event details.
            </div>
        `;
    }
}

// Render dynamic elements inside the detail side drawer
function renderMatchDetails(meta, details) {
    const incObj = details.incident || {};
    const incidents = incObj.incidents || [];
    const metadataList = incObj.metadata || [];
    const gameMeta = metadataList[0] || {};

    let incidentsHtml = "";
    if (incidents.length === 0) {
        incidentsHtml = `<div class="meta-row" style="color: var(--text-muted);">No recorded match events.</div>`;
    } else {
        // Map incident types to timeline styles
        incidentsHtml = incidents.map(item => {
            let eventClass = "";
            let detailText = "";
            
            const type = item.incident_type;
            if (type === "Goal") {
                eventClass = "goal";
                detailText = `Goal! scored by <strong>${item.player_name}</strong>${item.assist_player_name ? ` (assisted by ${item.assist_player_name})` : ''} — score: ${item.home_score}-${item.away_score}`;
            } else if (type === "Yellow Card") {
                eventClass = "card-yellow";
                detailText = `Yellow Card: <strong>${item.player_name}</strong>${item.card_reason ? ` (${item.card_reason})` : ''}`;
            } else if (type === "Red Card") {
                eventClass = "card-red";
                detailText = `Red Card! <strong>${item.player_name}</strong>${item.card_reason ? ` (${item.card_reason})` : ''}`;
            } else if (type === "Substitution") {
                eventClass = "substitution";
                detailText = `Substitution: <strong>${item.player_in}</strong> enters for <strong>${item.player_out}</strong>`;
            } else if (type === "Goal Disallowed") {
                eventClass = "card-red";
                detailText = `Goal disallowed: <strong>${item.player_name}</strong>${item.card_reason ? ` (${item.card_reason})` : ''}`;
            } else {
                detailText = `${type}: <strong>${item.player_name || ''}</strong>`;
            }

            const teamBadge = `<span class="timeline-team-badge ${item.team === 'away' ? 'away' : 'home'}">${item.team === 'away' ? 'Away' : 'Home'}</span>`;

            return `
                <div class="timeline-item ${eventClass}">
                    <div class="timeline-icon"></div>
                    <span class="timeline-time">${item.minute}</span>
                    ${teamBadge}
                    <div class="timeline-desc">${detailText}</div>
                </div>
            `;
        }).join("");
    }

    elements.drawerContent.innerHTML = `
        <div class="detail-header">
            <div class="detail-header-comp">${getDisplayLeague(meta.l)}</div>
            <div class="detail-header-date">${formatDate(meta.d)}</div>
            <div class="detail-score-board">
                <div class="score-team-name">${getDisplayTeam(meta.h)}</div>
                <div class="score-display">${meta.gh} - ${meta.ga}</div>
                <div class="score-team-name">${getDisplayTeam(meta.a)}</div>
            </div>
        </div>

        <section class="timeline-section">
            <h3 class="timeline-title">Match Incidents</h3>
            <div class="timeline-events">
                ${incidentsHtml}
            </div>
        </section>

        <section class="meta-section">
            <h3 class="timeline-title" style="border: none; margin-bottom: 0.5rem; padding: 0;">Match Info</h3>
            ${gameMeta.venue ? `
            <div class="meta-row">
                <span class="meta-label">Venue</span>
                <span class="meta-value">${gameMeta.venue}${gameMeta.city ? `, ${gameMeta.city}` : ''}</span>
            </div>` : ''}
            ${gameMeta.referee ? `
            <div class="meta-row">
                <span class="meta-label">Referee</span>
                <span class="meta-value">${gameMeta.referee}</span>
            </div>` : ''}
            ${gameMeta.attendance ? `
            <div class="meta-row">
                <span class="meta-label">Attendance</span>
                <span class="meta-value">${gameMeta.attendance} ${gameMeta.capacity ? `/ ${gameMeta.capacity}` : ''}</span>
            </div>` : ''}
        </section>
    `;
}
