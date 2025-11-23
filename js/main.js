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
    topN: 500,
    showType: 'all',
    minCount: 100,
    colorScheme: 'blue',
    fontSizeMin: 12,
    fontSizeMax: 99,
    userFilter: null
};
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
    document.getElementById('badge-messages').innerHTML = `Messages: ${summary.totalMessages.toLocaleString()}`;
    
    // Total Users
    document.getElementById('badge-users').innerHTML = `Users: ${summary.totalUsers.toLocaleString()}`;
    
    // Date Range
    const dateRange = summary.dateRange.start && summary.dateRange.end
        ? `${summary.dateRange.start} to ${summary.dateRange.end}`
        : 'N/A';
    document.getElementById('badge-date-range').innerHTML = `Date: ${dateRange}`;
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
    
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            
            // Render word cloud after modal is shown
            setTimeout(() => renderWordCloud(), 300);
        });
    }
    
    // Control event listeners
    document.getElementById('cloud-top-n').addEventListener('input', (e) => {
        document.getElementById('cloud-top-n-value').textContent = e.target.value;
        cloudSettings.topN = parseInt(e.target.value);
        renderWordCloud();
    });
    
    document.getElementById('cloud-type').addEventListener('change', (e) => {
        cloudSettings.showType = e.target.value;
        renderWordCloud();
    });
    
    document.getElementById('cloud-min-count').addEventListener('input', (e) => {
        document.getElementById('cloud-min-count-value').textContent = e.target.value;
        cloudSettings.minCount = parseInt(e.target.value);
        renderWordCloud();
    });
    
    document.getElementById('cloud-color').addEventListener('change', (e) => {
        cloudSettings.colorScheme = e.target.value;
        renderWordCloud();
    });
    
    document.getElementById('cloud-font-min').addEventListener('change', (e) => {
        cloudSettings.fontSizeMin = parseInt(e.target.value);
        renderWordCloud();
    });
    
    document.getElementById('cloud-font-max').addEventListener('change', (e) => {
        cloudSettings.fontSizeMax = parseInt(e.target.value);
        renderWordCloud();
    });
}

function renderWordCloud() {
    const data = getCloudData(cloudSettings);
    
    if (data.length === 0) {
        document.getElementById('word-cloud-container').innerHTML = 
            '<div class="alert alert-warning">No words match the current filters</div>';
        return;
    }
    
    const svg = d3.select('#word-cloud-svg');
    svg.selectAll('*').remove();
    
    const container = document.getElementById('word-cloud-container');
    const width = container.clientWidth || 1000;
    
    // Calculate available height (modal body height minus controls card and padding)
    const modalBody = container.closest('.modal-body');
    const controlsCard = modalBody.querySelector('.card');
    const availableHeight = modalBody.clientHeight - controlsCard.offsetHeight - 60; // 60px for padding
    const height = Math.max(availableHeight, 400); // Minimum 400px
    
    svg.attr('width', width).attr('height', height);
    
    // Create word cloud layout
    const layout = d3.layout.cloud()
        .size([width, height])
        .words(data.map(d => ({ text: d.text, size: d.size })))
        .padding(5)
        .rotate(() => 0)
        .font('Impact')
        .fontSize(d => d.size)
        .on('end', draw);
    
    layout.start();
    
    function draw(words) {
        const g = svg.append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`);
        
        const colorScale = getColorScale(cloudSettings.colorScheme);
        
        g.selectAll('text')
            .data(words)
            .enter().append('text')
            .attr('class', 'word-cloud-text')
            .style('font-size', d => d.size + 'px')
            .style('font-family', 'Impact')
            .style('fill', (d, i) => colorScale(i))
            .attr('text-anchor', 'middle')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .text(d => d.text);
    }
}

function getCloudData(settings) {
    const combined = [];
    
    // Filter by type
    if (settings.showType === 'all' || settings.showType === 'words') {
        Object.entries(rawData.words || {}).forEach(([text, count]) => {
            if (count >= settings.minCount) {
                combined.push({ text, count });
            }
        });
    }
    
    if (settings.showType === 'all' || settings.showType === 'phrases') {
        Object.entries(rawData.phrases || {}).forEach(([text, count]) => {
            if (count >= settings.minCount) {
                combined.push({ text, count });
            }
        });
    }
    
    // Sort and take top N
    combined.sort((a, b) => b.count - a.count);
    const topN = combined.slice(0, settings.topN);
    
    // Scale font sizes
    if (topN.length === 0) return [];
    
    const minCount = Math.min(...topN.map(d => d.count));
    const maxCount = Math.max(...topN.map(d => d.count));
    
    return topN.map(d => ({
        text: d.text,
        size: scaleValue(d.count, minCount, maxCount, settings.fontSizeMin, settings.fontSizeMax)
    }));
}

function getColorScale(scheme) {
    const schemes = {
        default: d3.scaleOrdinal(d3.schemeCategory10),
        blue: d3.scaleSequential(d3.interpolateBlues).domain([0, 100]),
        green: d3.scaleSequential(d3.interpolateGreens).domain([0, 100]),
        warm: d3.scaleSequential(d3.interpolateWarm).domain([0, 100]),
        cool: d3.scaleSequential(d3.interpolateCool).domain([0, 100])
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

