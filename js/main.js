// Global State
let rawData = null;
let customWordList = [];
let currentFilters = {
    user: '',
    dateStart: '',
    dateEnd: '',
    timelineView: 'monthly'
};
let cloudSettings = {
    rankMin: 1,
    rankMax: 500,
    rankEnabled: true,
    showType: 'all',
    countMin: 100,
    countMax: Infinity,
    countEnabled: true,
    colorScheme: 'blue',
    fontSizeMin: 12,
    fontSizeMax: 50,
    userFilter: null
};
let rankSlider = null;
let countSlider = null;
let fontSlider = null;
let currentZoom = 1;
let userTable = null;
let wordPhraseTable = null;
let activityChart = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    initThemeToggle();
    loadData();
});

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadData() {
    try {
        const response = await fetch('data/processed-data.json');
        if (!response.ok) throw new Error('Failed to load data');
        
        rawData = await response.json();
        console.log('Data loaded:', rawData);
        
        // Load custom word list from localStorage
        loadCustomWordList();
        
        // Initialize UI
        renderSummary();
        populateUserFilter();
        initUserTable();
        initWordPhraseTable();
        renderChart();
        
        // Setup event listeners
        initFilters();
        initWordCloudModal();
        
        // Hide loading, show content
        document.getElementById('loading-spinner').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loading-spinner').innerHTML = `
            <div class="alert alert-danger">
                <h5>Error Loading Data</h5>
                <p>Failed to load processed-data.json. Make sure you've run the preprocessing script.</p>
                <code>${error.message}</code>
            </div>
        `;
    }
}

function loadCustomWordList() {
    const stored = localStorage.getItem('customWordList');
    if (stored) {
        try {
            customWordList = JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing stored word list:', e);
            customWordList = [];
        }
    }
    
    // Default words if none stored
    if (customWordList.length === 0) {
        customWordList = ['scion', 'warrior', 'blink', 'lancer', 'isdf', 'hadean', 'invest', 'shut the fuck up'];
        saveCustomWordList();
    }
    
    // Render the word list items
    renderCustomWordItems();
}

function saveCustomWordList() {
    localStorage.setItem('customWordList', JSON.stringify(customWordList));
}

// ============================================================================
// THEME TOGGLE
// ============================================================================

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function saveTheme(theme) {
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    saveTheme(newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const lightIcon = document.getElementById('theme-icon-light');
    const darkIcon = document.getElementById('theme-icon-dark');
    
    if (theme === 'dark') {
        lightIcon.style.display = 'none';
        darkIcon.style.display = 'inline';
    } else {
        lightIcon.style.display = 'inline';
        darkIcon.style.display = 'none';
    }
}

function initThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTheme);
    }
}

// ============================================================================
// SUMMARY BADGES
// ============================================================================

function renderSummary() {
    const { summary } = rawData;
    
    // Total Messages
    document.getElementById('badge-messages').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" class="bi bi-chat-dots" viewBox="0 0 16 16">
            <path d="M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>
            <path d="m2.165 15.803.02-.004c1.83-.363 2.948-.842 3.468-1.105A9 9 0 0 0 8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a10.4 10.4 0 0 1-.524 2.318l-.003.011a11 11 0 0 1-.244.637c-.079.186.074.394.273.362a22 22 0 0 0 .693-.125m.8-3.108a1 1 0 0 0-.287-.801C1.618 10.83 1 9.468 1 8c0-3.192 3.004-6 7-6s7 2.808 7 6-3.004 6-7 6a8 8 0 0 1-2.088-.272 1 1 0 0 0-.711.074c-.387.196-1.24.57-2.634.893a11 11 0 0 0 .398-2"/>
        </svg>
        <span class="ms-1">${summary.totalMessages.toLocaleString()}</span>`;
    document.getElementById('badge-messages').setAttribute('title', 'Messages');
    
    // Total Users
    document.getElementById('badge-users').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" class="bi bi-person" viewBox="0 0 16 16">
            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>
        </svg>
        <span class="ms-1">${summary.totalUsers.toLocaleString()}</span>`;
    document.getElementById('badge-users').setAttribute('title', 'Users');
    
    // Total Words
    const totalWords = Object.keys(rawData.words || {}).length;
    document.getElementById('badge-words').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" class="bi bi-alphabet-uppercase" viewBox="0 0 16 16">
            <path d="M1.226 10.88H0l2.056-6.26h1.42l2.047 6.26h-1.29l-.48-1.61H1.707l-.48 1.61ZM2.76 5.818h-.054l-.75 2.532H3.51zm3.217 5.062V4.62h2.56c1.09 0 1.808.582 1.808 1.54 0 .762-.444 1.22-1.05 1.372v.055c.736.074 1.365.587 1.365 1.528 0 1.119-.89 1.766-2.133 1.766zM7.18 5.55v1.675h.8c.812 0 1.171-.308 1.171-.853 0-.51-.328-.822-.898-.822zm0 2.537V9.95h.903c.951 0 1.342-.312 1.342-.909 0-.591-.382-.954-1.095-.954zm5.089-.711v.775c0 1.156.49 1.803 1.347 1.803.705 0 1.163-.454 1.212-1.096H16v.12C15.942 10.173 14.95 11 13.607 11c-1.648 0-2.573-1.073-2.573-2.849v-.78c0-1.775.934-2.871 2.573-2.871 1.347 0 2.34.849 2.393 2.087v.115h-1.172c-.05-.665-.516-1.156-1.212-1.156-.849 0-1.347.67-1.347 1.83"/>
        </svg>
        <span class="ms-1">${totalWords.toLocaleString()}</span>`;
    document.getElementById('badge-words').setAttribute('title', 'Words');
    
    // Date Range - Format dates to YY.MM.DD
    const formatDateShort = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yy}.${mm}.${dd}`;
    };
    
    const dateRange = summary.dateRange.start && summary.dateRange.end
        ? `${formatDateShort(summary.dateRange.start)} - ${formatDateShort(summary.dateRange.end)}`
        : 'N/A';
    document.getElementById('badge-date-range').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" class="bi bi-calendar3" viewBox="0 0 16 16">
            <path d="M14 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2M1 3.857C1 3.384 1.448 3 2 3h12c.552 0 1 .384 1 .857v10.286c0 .473-.448.857-1 .857H2c-.552 0-1-.384-1-.857z"/>
            <path d="M6.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m-9 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m-9 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2m3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>
        </svg>
        <span class="ms-1">${dateRange}</span>`;
    document.getElementById('badge-date-range').setAttribute('title', 'Date Range');
}

// ============================================================================
// USER TABLE
// ============================================================================

function initUserTable() {
    userTable = $('#user-table').DataTable({
        data: rawData.users,
        columns: [
            { 
                data: 'displayName',
                render: (data, type, row) => {
                    if (row.aliases && row.aliases.length > 0) {
                        return `${data} <small class="text-muted">(${row.aliases.length} alias${row.aliases.length > 1 ? 'es' : ''})</small>`;
                    }
                    return data;
                }
            },
            { data: 'messageCount', render: $.fn.dataTable.render.number(',') },
            { data: 'wordCount', render: $.fn.dataTable.render.number(',') },
            { 
                data: 'activityScore',
                render: (data) => data.toFixed(1)
            },
            { 
                data: 'totalReactions',
                render: (data) => data > 0 ? data.toLocaleString() : '0'
            }
        ],
        order: [[3, 'desc']], // Sort by activity score
        pageLength: 25,
        lengthChange: false,
        searching: true,
        info: false,
        responsive: true,
        dom: '<"user-table-controls"f>rtp',
        language: {
            search: '',
            searchPlaceholder: 'Search users...',
            paginate: {
                previous: '‹',
                next: '›'
            }
        }
    });
    
    // Click to expand emoji breakdown
    $('#user-table tbody').on('click', 'tr', function() {
        const tr = $(this);
        const row = userTable.row(tr);
        
        if (row.child.isShown()) {
            row.child.hide();
            tr.removeClass('shown');
        } else {
            const rowData = row.data();
            if (rowData.totalReactions > 0) {
                row.child(formatEmojiBreakdown(rowData.emojiBreakdown)).show();
                tr.addClass('shown');
            }
        }
    });
}

function formatEmojiBreakdown(emojiData) {
    if (!emojiData || Object.keys(emojiData).length === 0) {
        return '<div class="p-2 text-muted">No reactions received</div>';
    }
    
    const sorted = Object.entries(emojiData).sort((a, b) => b[1] - a[1]);
    
    let html = '<div class="emoji-breakdown-row p-3">';
    html += '<table class="table table-sm table-borderless emoji-breakdown-table">';
    html += '<thead><tr><th>Emoji</th><th>Count</th></tr></thead><tbody>';
    
    sorted.forEach(([emoji, count]) => {
        html += `<tr><td>${emoji}</td><td>${count.toLocaleString()}</td></tr>`;
    });
    
    html += '</tbody></table></div>';
    return html;
}

// ============================================================================
// WORD/PHRASE TABLE
// ============================================================================

function initWordPhraseTable() {
    const combinedData = combineWordsAndPhrases();
    
    wordPhraseTable = $('#word-phrase-table').DataTable({
        data: combinedData,
        columns: [
            { 
                data: null,
                render: (data, type, row, meta) => meta.row + 1
            },
            { data: 'text' },
            { data: 'count', render: $.fn.dataTable.render.number(',') }
        ],
        order: [[2, 'desc']], // Sort by count
        pageLength: 50,
        lengthChange: false,
        searching: true,
        info: true,
        language: {
            search: 'Search:',
            paginate: {
                previous: '‹',
                next: '›'
            }
        }
    });
    
    // Initialize custom word list controls
    initCustomWordListControls();
}

function combineWordsAndPhrases() {
    const combined = [];
    
    // Add words
    if (rawData.words) {
        Object.entries(rawData.words).forEach(([text, count]) => {
            combined.push({ text, count, type: 'word' });
        });
    }
    
    // Add phrases
    if (rawData.phrases) {
        Object.entries(rawData.phrases).forEach(([text, count]) => {
            combined.push({ text, count, type: 'phrase' });
        });
    }
    
    // Sort by count descending
    combined.sort((a, b) => b.count - a.count);
    
    return combined;
}

function initCustomWordListControls() {
    // Add word button
    document.getElementById('btn-add-word').addEventListener('click', addCustomWord);
    
    // Add word on Enter key
    document.getElementById('new-word-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCustomWord();
        }
    });
    
    // Apply filter button
    document.getElementById('btn-apply-filter').addEventListener('click', applyCustomWordFilter);
    
    // Clear filter button
    document.getElementById('btn-clear-filter').addEventListener('click', clearCustomWordFilter);
}

function renderCustomWordItems() {
    const container = document.getElementById('custom-word-items');
    if (!container) return;
    
    if (customWordList.length === 0) {
        container.innerHTML = '<p class="text-muted small">No words in list. Add words below.</p>';
        return;
    }
    
    container.innerHTML = customWordList.map((word, index) => `
        <div class="custom-word-item d-flex align-items-center mb-2">
            <span class="flex-grow-1">${escapeHtml(word)}</span>
            <button class="btn btn-sm btn-outline-danger" onclick="removeCustomWord(${index})" type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
                    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function addCustomWord() {
    const input = document.getElementById('new-word-input');
    const word = normalizeText(input.value);
    
    if (!word) return;
    
    // Check for duplicates
    if (customWordList.includes(word)) {
        input.value = '';
        return;
    }
    
    customWordList.push(word);
    saveCustomWordList();
    renderCustomWordItems();
    input.value = '';
}

function removeCustomWord(index) {
    customWordList.splice(index, 1);
    saveCustomWordList();
    renderCustomWordItems();
}

function applyCustomWordFilter() {
    if (!customWordList || customWordList.length === 0) {
        wordPhraseTable.column(1).search('').draw();
        return;
    }
    
    // Build regex search pattern
    const escaped = customWordList.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = '^(' + escaped.join('|') + ')$';
    
    wordPhraseTable.column(1).search(pattern, true, false).draw();
}

function clearCustomWordFilter() {
    wordPhraseTable.column(1).search('').draw();
}

// ============================================================================
// ACTIVITY CHART
// ============================================================================

function renderChart() {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    const timelineData = getTimelineData(currentFilters.timelineView);
    
    if (activityChart) {
        activityChart.destroy();
    }
    
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timelineData.labels,
            datasets: [{
                label: 'Messages',
                data: timelineData.values,
                borderColor: 'rgb(13, 110, 253)',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function getTimelineData(view) {
    const timeline = rawData.timeline;
    let data = [];
    
    switch (view) {
        case 'daily':
            data = timeline.daily;
            return {
                labels: data.map(d => d.date),
                values: data.map(d => d.count)
            };
        case 'weekly':
            data = timeline.weekly;
            return {
                labels: data.map(d => d.week),
                values: data.map(d => d.count)
            };
        case 'monthly':
            data = timeline.monthly;
            return {
                labels: data.map(d => d.month),
                values: data.map(d => d.count)
            };
        default:
            return { labels: [], values: [] };
    }
}

function updateChartTimeline(view) {
    currentFilters.timelineView = view;
    renderChart();
}

// ============================================================================
// FILTERS
// ============================================================================

function populateUserFilter() {
    const select = document.getElementById('filter-user');
    if (!select) return;
    
    rawData.users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.displayName;
        option.textContent = user.displayName;
        select.appendChild(option);
    });
}

function initFilters() {
    // User filter
    const userSelect = document.getElementById('filter-user');
    if (userSelect) {
        userSelect.addEventListener('change', (e) => {
            currentFilters.user = e.target.value;
            applyFilters();
        });
    }
    
    // Date filters
    const dateStart = document.getElementById('filter-date-start');
    const dateEnd = document.getElementById('filter-date-end');
    
    if (dateStart) {
        dateStart.addEventListener('change', (e) => {
            currentFilters.dateStart = e.target.value;
            applyFilters();
        });
    }
    
    if (dateEnd) {
        dateEnd.addEventListener('change', (e) => {
            currentFilters.dateEnd = e.target.value;
            applyFilters();
        });
    }
    
    // Timeline toggle
    const timelineToggles = document.querySelectorAll('input[name="timeline-view"]');
    timelineToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                updateChartTimeline(e.target.value);
            }
        });
    });
    
    // Reset filters
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }
}

function applyFilters() {
    // For now, filters only affect the chart
    // User filter and date range filter would require per-user timeline data
    console.log('Filters applied:', currentFilters);
    
    // Note: With current data structure, we can only filter timeline by date
    // User filtering would require preprocessing changes to track per-user timelines
}

function resetFilters() {
    currentFilters.user = '';
    currentFilters.dateStart = '';
    currentFilters.dateEnd = '';
    
    document.getElementById('filter-user').value = '';
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    
    applyFilters();
}

// ============================================================================
// WORD CLOUD MODAL
// ============================================================================

function initWordCloudModal() {
    const openBtn = document.getElementById('btn-open-word-cloud');
    const modal = document.getElementById('word-cloud-modal');
    let resizeTimeout;
    
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            
            // Initialize sliders if not already done
            if (!rankSlider) {
                initRangeSliders();
            }
            
            // Initialize Bootstrap tooltips
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
            
            // Render word cloud after modal is shown
            setTimeout(() => {
                currentZoom = 1; // Reset zoom when opening modal
                renderWordCloud();
            }, 300);
        });
        
        // Zoom controls
        document.getElementById('zoom-in-btn').addEventListener('click', () => {
            currentZoom = Math.min(currentZoom + 0.2, 3); // Max 3x zoom
            applyZoom();
        });
        
        document.getElementById('zoom-out-btn').addEventListener('click', () => {
            currentZoom = Math.max(currentZoom - 0.2, 0.5); // Min 0.5x zoom
            applyZoom();
        });
        
        document.getElementById('zoom-reset-btn').addEventListener('click', () => {
            currentZoom = 1;
            applyZoom();
        });
        
        // Controls collapse toggle with localStorage
        const controlsCollapse = document.getElementById('word-cloud-controls');
        const controlsIcon = document.getElementById('toggle-controls-icon');
        
        // Load saved state
        const controlsState = localStorage.getItem('wordCloudControlsCollapsed');
        if (controlsState === 'true') {
            bootstrap.Collapse.getOrCreateInstance(controlsCollapse).hide();
        }
        
        controlsCollapse.addEventListener('shown.bs.collapse', () => {
            localStorage.setItem('wordCloudControlsCollapsed', 'false');
            controlsIcon.innerHTML = '<path fill-rule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708z"/>';
            setTimeout(() => renderWordCloud(), 300); // Redraw with new dimensions
        });
        
        controlsCollapse.addEventListener('hidden.bs.collapse', () => {
            localStorage.setItem('wordCloudControlsCollapsed', 'true');
            controlsIcon.innerHTML = '<path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>';
            setTimeout(() => renderWordCloud(), 300); // Redraw with new dimensions
        });
        
        // Add resize listener for responsive word cloud
        window.addEventListener('resize', () => {
            // Only re-render if modal is visible
            if (modal.classList.contains('show')) {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    renderWordCloud();
                }, 250); // Debounce resize events
            }
        });
    }
    
    // Control event listeners
    document.getElementById('cloud-type').addEventListener('change', (e) => {
        cloudSettings.showType = e.target.value;
        renderWordCloud();
    });
    
    document.getElementById('cloud-color').addEventListener('change', (e) => {
        cloudSettings.colorScheme = e.target.value;
        renderWordCloud();
    });
    
    // Filter enable/disable toggles
    document.getElementById('cloud-rank-enabled').addEventListener('change', (e) => {
        cloudSettings.rankEnabled = e.target.checked;
        const slider = document.getElementById('cloud-rank-range');
        slider.style.opacity = e.target.checked ? '1' : '0.3';
        rankSlider.set(e.target.checked ? [cloudSettings.rankMin, cloudSettings.rankMax] : [1, 1000]);
        if (e.target.checked) {
            renderWordCloud();
        } else {
            // Reset to full range when disabled
            cloudSettings.rankMin = 1;
            cloudSettings.rankMax = 1000;
            renderWordCloud();
        }
    });
    
    document.getElementById('cloud-count-enabled').addEventListener('change', (e) => {
        cloudSettings.countEnabled = e.target.checked;
        const slider = document.getElementById('cloud-count-range');
        slider.style.opacity = e.target.checked ? '1' : '0.3';
        if (!e.target.checked) {
            // Reset to full range when disabled
            cloudSettings.countMin = 1;
            cloudSettings.countMax = Infinity;
        }
        renderWordCloud();
    });
}

function initRangeSliders() {
    // Rank range slider
    const rankSliderElement = document.getElementById('cloud-rank-range');
    rankSlider = noUiSlider.create(rankSliderElement, {
        start: [1, 500],
        connect: true,
        step: 1,
        range: {
            'min': 1,
            'max': 1000
        },
        tooltips: false
    });
    
    rankSlider.on('update', (values) => {
        const min = Math.round(values[0]);
        const max = Math.round(values[1]);
        document.getElementById('cloud-rank-range-value').textContent = `${min} - ${max}`;
        cloudSettings.rankMin = min;
        cloudSettings.rankMax = max;
    });
    
    rankSlider.on('change', () => {
        renderWordCloud();
    });
    
    // Count range slider
    const countSliderElement = document.getElementById('cloud-count-range');
    countSlider = noUiSlider.create(countSliderElement, {
        start: [100, 1000],
        connect: true,
        step: 10,
        range: {
            'min': 1,
            'max': 1000
        },
        tooltips: false
    });
    
    countSlider.on('update', (values) => {
        const min = Math.round(values[0]);
        const max = Math.round(values[1]);
        const maxDisplay = max >= 1000 ? '∞' : max;
        document.getElementById('cloud-count-range-value').textContent = `${min} - ${maxDisplay}`;
        cloudSettings.countMin = min;
        cloudSettings.countMax = max >= 1000 ? Infinity : max;
    });
    
    countSlider.on('change', () => {
        renderWordCloud();
    });
    
    // Font size range slider
    const fontSliderElement = document.getElementById('cloud-font-range');
    fontSlider = noUiSlider.create(fontSliderElement, {
        start: [12, 50],
        connect: true,
        step: 1,
        range: {
            'min': 8,
            'max': 150
        },
        tooltips: false
    });
    
    fontSlider.on('update', (values) => {
        const min = Math.round(values[0]);
        const max = Math.round(values[1]);
        document.getElementById('cloud-font-range-value').textContent = `${min} - ${max}`;
        cloudSettings.fontSizeMin = min;
        cloudSettings.fontSizeMax = max;
    });
    
    fontSlider.on('change', () => {
        renderWordCloud();
    });
}

function showWordCloudLoading() {
    document.getElementById('word-cloud-loading').style.display = 'flex';
}

function hideWordCloudLoading() {
    document.getElementById('word-cloud-loading').style.display = 'none';
}

function renderWordCloud() {
    // Show loading immediately
    showWordCloudLoading();
    
    // Use setTimeout to ensure loading indicator renders before heavy processing
    setTimeout(() => {
        const data = getCloudData(cloudSettings);
        
        if (data.length === 0) {
            hideWordCloudLoading();
            document.getElementById('word-cloud-container').innerHTML = 
                '<div class="alert alert-warning">No words match the current filters</div>';
            return;
        }
        
        const svg = d3.select('#word-cloud-svg');
        svg.selectAll('*').remove();
        
        const container = document.getElementById('word-cloud-container');
        
        // Calculate dimensions based on actual viewport and modal dimensions
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        console.log('Word cloud dimensions:', width, 'x', height); // Debug log
    
    svg.attr('width', width).attr('height', height);
    
        // Create word cloud layout with subtle angle variation
        const layout = d3.layout.cloud()
            .size([width - 20, height - 20]) // Minimal padding from edges
            .words(data.map(d => ({ text: d.text, size: d.size })))
            .padding(5)
            .rotate(() => {
                // Mostly horizontal (0°), with occasional slight angles
                // 70% horizontal, 30% angled (-30° or 30°)
                const rand = Math.random();
                if (rand < 0.7) return 0;
                return rand < 0.85 ? -30 : 30;
            })
            .font('Impact')
            .fontSize(d => d.size) // Size already scaled in getCloudData
            .spiral('rectangular')
            .on('end', draw);
        
        function draw(words) {
            const g = svg.append('g')
                .attr('class', 'word-cloud-group')
                .attr('transform', `translate(${width / 2},${height / 2})scale(${currentZoom})`);
            
            const colorScale = getColorScale(cloudSettings.colorScheme);
            
            g.selectAll('text')
                .data(words)
                .enter().append('text')
                .attr('class', 'word-cloud-text')
                .style('font-size', d => d.size + 'px')
                .style('font-family', 'Impact')
                .style('fill', (d, i) => colorScale(i))
                .attr('text-anchor', 'middle')
                .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
                .text(d => d.text);
            
            // Hide loading after rendering
            hideWordCloudLoading();
        }
        
        layout.start();
    }, 10); // Small delay to ensure loading indicator renders
}

function getCloudData(settings) {
    const combined = [];
    
    // Determine effective count range (use full range if disabled)
    const effectiveCountMin = settings.countEnabled ? settings.countMin : 1;
    const effectiveCountMax = settings.countEnabled ? settings.countMax : Infinity;
    
    // Filter by type and count range
    if (settings.showType === 'all' || settings.showType === 'words') {
        Object.entries(rawData.words || {}).forEach(([text, count]) => {
            if (count >= effectiveCountMin && count <= effectiveCountMax) {
                combined.push({ text, count });
            }
        });
    }
    
    if (settings.showType === 'all' || settings.showType === 'phrases') {
        Object.entries(rawData.phrases || {}).forEach(([text, count]) => {
            if (count >= effectiveCountMin && count <= effectiveCountMax) {
                combined.push({ text, count });
            }
        });
    }
    
    // Sort by count descending
    combined.sort((a, b) => b.count - a.count);
    
    // Apply rank range (slice by position in sorted list) - use full range if disabled
    const effectiveRankMin = settings.rankEnabled ? settings.rankMin : 1;
    const effectiveRankMax = settings.rankEnabled ? settings.rankMax : combined.length;
    const rankedWords = combined.slice(effectiveRankMin - 1, effectiveRankMax);
    
    // Scale font sizes
    if (rankedWords.length === 0) return [];
    
    const minCount = Math.min(...rankedWords.map(d => d.count));
    const maxCount = Math.max(...rankedWords.map(d => d.count));
    
    return rankedWords.map(d => ({
        text: d.text,
        size: scaleValue(d.count, minCount, maxCount, settings.fontSizeMin, settings.fontSizeMax)
    }));
}

function applyZoom() {
    const svg = d3.select('#word-cloud-svg');
    const group = svg.select('.word-cloud-group');
    
    if (!group.empty()) {
        const container = document.getElementById('word-cloud-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        group.transition()
            .duration(200)
            .attr('transform', `translate(${width / 2},${height / 2})scale(${currentZoom})`);
    }
}

function getColorScale(scheme) {
    // Check if we're in dark mode
    const isDarkMode = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    
    // For sequential scales, adjust domain to avoid lightest colors in light mode
    // and avoid darkest colors in dark mode
    const schemes = {
        default: d3.scaleOrdinal(d3.schemeCategory10),
        blue: isDarkMode 
            ? d3.scaleSequential(d3.interpolateBlues).domain([0, 100])
            : d3.scaleSequential(t => d3.interpolateBlues(0.4 + t * 0.6)).domain([0, 100]),
        green: isDarkMode
            ? d3.scaleSequential(d3.interpolateGreens).domain([0, 100])
            : d3.scaleSequential(t => d3.interpolateGreens(0.4 + t * 0.6)).domain([0, 100]),
        warm: isDarkMode
            ? d3.scaleSequential(d3.interpolateWarm).domain([0, 100])
            : d3.scaleSequential(t => d3.interpolateWarm(0.3 + t * 0.7)).domain([0, 100]),
        cool: isDarkMode
            ? d3.scaleSequential(d3.interpolateCool).domain([0, 100])
            : d3.scaleSequential(t => d3.interpolateCool(0.3 + t * 0.7)).domain([0, 100])
    };
    
    return schemes[scheme] || schemes.default;
}

// ============================================================================
// UTILITIES
// ============================================================================

function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function scaleValue(value, minVal, maxVal, minScale, maxScale) {
    if (maxVal === minVal) return minScale;
    return minScale + ((value - minVal) / (maxVal - minVal)) * (maxScale - minScale);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Make removeCustomWord globally accessible for inline onclick
window.removeCustomWord = removeCustomWord;

