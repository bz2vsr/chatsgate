# Per-User Analysis Implementation Plan

## Overview

Add comprehensive per-user analysis with efficient lazy-loading architecture, relationship mapping, and dedicated visualizations for individual users.

## Architecture

- **Data Storage**: Separate JSON files per user in `data/users/` directory
- **Loading Strategy**: Lazy load user data on-demand when selected
- **UI Approach**: Activate hidden filter section with user dropdown to switch entire dashboard
- **Relationships**: Track mention patterns and reaction exchange between users

## Key Design Decisions

1. **Separate Files**: Generate `data/users/{username}.json` for each user to avoid massive monolithic file
2. **On-Demand Loading**: Only fetch user data when selected, cache in memory once loaded
3. **Dashboard Mode Toggle**: Switch between "All Users" (global) and "Per User" modes
4. **Relationship Graphs**: Visual display of top mention and reaction partners

## User Table Behavior in User Mode

When a user is selected:
- Hide the full user table
- Display only the selected user as a single row summary card showing their key stats
- Provide visual prominence to the selected user's information

## Mention Resolution

Discord stores mentions as `<@USER_ID>` format. We will:
- Build a user ID to display name mapping during preprocessing
- Resolve all mention IDs to readable display names
- Store resolved names in relationship data

## Data Export Limits

No artificial limits on per-user data:
- Export ALL words with their counts (no top N limit)
- Export ALL phrases with their counts (no top N limit)
- This ensures complete data accuracy for power users
- File sizes may reach 1MB+ for very active users (acceptable tradeoff)

## Part 1: Preprocessing Updates (preprocess.py)

### Changes to Data Extraction

**Add per-user tracking dictionaries** (after line 105):
- `user_messages`: Track all message data per user (timestamp, text, reactions)
- `user_mentions_given`: Who each user @mentions
- `user_mentions_received`: Who gets @mentioned by each user
- `reactions_given`: Track reactions each user GIVES to others
- `reactions_received`: Already tracking (keep current implementation)

**Extract mentions from messages** (in message loop ~line 130):
- Parse message content for @mentions using regex: `@(\w+)` or Discord mention format
- Track in both `user_mentions_given[author_id]` and `user_mentions_received[mentioned_user_id]`

**Track reaction givers** (update reaction extraction ~line 146):
- Currently only tracking reactions RECEIVED
- Add tracking for who GAVE each reaction (if available in Discord data structure)
- Store in `reactions_given[user_id]` counter

### Generate Per-User Data Files

**Create user data export function** (new function ~line 270):

```python
def export_user_data(user_id, user_data, all_messages, user_mentions, reactions_data):
    """Generate comprehensive per-user JSON file"""
    
    # Filter messages for this user
    user_msgs = [msg for msg in all_messages if msg['author_id'] == user_id]
    
    # Calculate per-user word counts
    user_word_counter = Counter()
    user_phrase_counter = Counter()
    for msg in user_msgs:
        # Same word/phrase extraction logic as global
        words = extract_words(msg['text'])
        user_word_counter.update(words)
        phrases = extract_phrases(msg['text'])
        user_phrase_counter.update(phrases)
    
    # Build timeline (daily activity)
    user_timeline = build_timeline(user_msgs)
    
    # Top mention/reaction partners
    mentions_given = user_mentions['given'][user_id].most_common(10)
    mentions_received = user_mentions['received'][user_id].most_common(10)
    reactions_given = reactions_data['given'][user_id].most_common(10)
    reactions_received = reactions_data['received'][user_id].most_common(10)
    
    return {
        'userId': user_id,
        'displayName': user_data['displayName'],
        'stats': {
            'messageCount': user_data['messageCount'],
            'wordCount': user_data['wordCount'],
            'activityScore': user_data['activityScore']
        },
        'words': dict(user_word_counter.most_common()),
        'phrases': dict(user_phrase_counter.most_common(200)),
        'timeline': user_timeline,
        'relationships': {
            'mentionsGiven': [{'user': name, 'count': count} for name, count in mentions_given],
            'mentionsReceived': [{'user': name, 'count': count} for name, count in mentions_received],
            'reactionsGiven': [{'user': name, 'count': count} for name, count in reactions_given],
            'reactionsReceived': [{'user': name, 'count': count, 'emojis': emojis} for name, count, emojis in reactions_received]
        }
    }
```

**Export all user files** (in main ~line 280):

```python
# Create users directory
users_dir = Path('data/users')
users_dir.mkdir(exist_ok=True)

# Export each user
for user_id, user_data in user_stats.items():
    user_json = export_user_data(user_id, user_data, all_messages, user_mentions, reactions_data)
    
    # Sanitize filename (remove special chars)
    safe_name = re.sub(r'[^\w\-]', '_', user_data['displayName'])
    output_path = users_dir / f"{safe_name}.json"
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(user_json, f, indent=2, ensure_ascii=False)

print(f"Exported {len(user_stats)} user data files to {users_dir}/")
```

### Update Global Data Output

**Add user file mapping** to `processed-data.json` (line ~260):

```python
'userFiles': {
    user_data['displayName']: f"data/users/{safe_name}.json" 
    for user_id, user_data in user_stats.items()
}
```

## Part 2: Frontend Implementation

### HTML Changes (index.html)

**Unhide and enhance filter section** (~line 61):

```html
<!-- Filters (User Selection) -->
<div class="card mb-3" id="filterCard">
    <div class="card-header d-flex justify-content-between align-items-center">
        <h6 class="mb-0">View Mode</h6>
        <button class="btn btn-sm btn-outline-secondary" id="btn-reset-filters" style="display: none;">
            Show All Users
        </button>
    </div>
    <div class="card-body">
        <div class="mb-2">
            <label for="filter-user" class="form-label">Select User</label>
            <select class="form-select form-select-sm" id="filter-user">
                <option value="">All Users (Global View)</option>
                <!-- Populated by JS -->
            </select>
        </div>
        <div id="user-load-status" class="text-muted small" style="display: none;">
            <span class="spinner-border spinner-border-sm me-1"></span>
            Loading user data...
        </div>
    </div>
</div>
```

**Add relationships section in left panel** (after user stats card ~line 110):

```html
<!-- User Relationships (Hidden until user selected) -->
<div class="card" id="relationships-card" style="display: none;">
    <div class="card-header">
        <h6 class="mb-0">Relationships</h6>
    </div>
    <div class="card-body">
        <h6 class="small text-muted mb-2">Top Mentions</h6>
        <div id="mentions-viz" class="mb-3"></div>
        
        <h6 class="small text-muted mb-2">Top Reaction Exchange</h6>
        <div id="reactions-viz"></div>
    </div>
</div>
```

### CSS Changes (css/main.css)

**Add relationship visualization styles**:

```css
/* Relationship bars */
.relationship-bar {
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;
}

.relationship-bar .label {
    flex: 0 0 120px;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.relationship-bar .bar-container {
    flex: 1;
    height: 24px;
    background-color: var(--bs-secondary-bg);
    border-radius: 4px;
    overflow: hidden;
}

.relationship-bar .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--bs-primary), var(--bs-info));
    display: flex;
    align-items: center;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    color: white;
    font-weight: 600;
    transition: width 0.3s ease;
}

/* Loading state for relationships */
#relationships-card .card-body.loading {
    opacity: 0.6;
    pointer-events: none;
}
```

### JavaScript Changes (js/main.js)

**Add global state variables** (~line 10):

```javascript
let currentUserData = null; // Cached user data
let currentViewMode = 'global'; // 'global' or 'user'
let loadedUsers = {}; // Cache for loaded user data
```

**Initialize filter section** (new function):

```javascript
function initUserFilter() {
    const filterSelect = document.getElementById('filter-user');
    const resetBtn = document.getElementById('btn-reset-filters');
    
    // Show filter card
    document.getElementById('filterCard').style.display = 'block';
    
    // Populate user dropdown from global data
    const users = rawData.users || [];
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.displayName;
        option.textContent = `${user.displayName} (${user.messageCount} msgs)`;
        filterSelect.appendChild(option);
    });
    
    // Event listener
    filterSelect.addEventListener('change', async (e) => {
        const username = e.target.value;
        if (username) {
            await loadUserView(username);
        } else {
            resetToGlobalView();
        }
    });
    
    resetBtn.addEventListener('click', () => {
        filterSelect.value = '';
        resetToGlobalView();
    });
}
```

**Load user data** (new function):

```javascript
async function loadUserView(username) {
    try {
        // Show loading indicator
        showUserLoadingStatus(true);
        currentViewMode = 'user';
        
        // Check cache first
        if (loadedUsers[username]) {
            currentUserData = loadedUsers[username];
        } else {
            // Fetch user data file
            const filepath = rawData.userFiles[username];
            const response = await fetch(filepath);
            if (!response.ok) throw new Error('User data not found');
            
            currentUserData = await response.json();
            loadedUsers[username] = currentUserData; // Cache it
        }
        
        // Update UI
        showUserLoadingStatus(false);
        document.getElementById('btn-reset-filters').style.display = 'inline-block';
        
        // Re-render all components with user data
        renderUserSummary();
        renderUserChart();
        updateWordPhraseTableForUser();
        renderRelationships();
        
        console.log('Loaded user view:', username);
        
    } catch (error) {
        console.error('Error loading user data:', error);
        alert('Failed to load user data. Please try again.');
        resetToGlobalView();
    }
}
```

**Reset to global view** (new function):

```javascript
function resetToGlobalView() {
    currentViewMode = 'global';
    currentUserData = null;
    
    document.getElementById('btn-reset-filters').style.display = 'none';
    document.getElementById('relationships-card').style.display = 'none';
    
    // Re-render with global data
    renderSummary();
    renderChart();
    wordPhraseTable.clear().rows.add(combineWordsAndPhrases()).draw();
    
    console.log('Reset to global view');
}
```

**Update chart rendering** (modify existing `renderChart`):

```javascript
function renderChart() {
    const timelineData = currentViewMode === 'user' 
        ? currentUserData.timeline 
        : rawData.timeline;
    
    // Existing chart logic, but use timelineData variable
    // ... rest of chart code
}
```

**Update word/phrase table** (new function):

```javascript
function updateWordPhraseTableForUser() {
    const combined = [];
    
    if (currentUserData.words) {
        Object.entries(currentUserData.words).forEach(([word, count]) => {
            combined.push({ text: word, count, type: 'word' });
        });
    }
    
    if (currentUserData.phrases) {
        Object.entries(currentUserData.phrases).forEach(([phrase, count]) => {
            combined.push({ text: phrase, count, type: 'phrase' });
        });
    }
    
    // Sort by count
    combined.sort((a, b) => b.count - a.count);
    
    // Add rank
    combined.forEach((item, idx) => item.rank = idx + 1);
    
    // Update DataTable
    wordPhraseTable.clear().rows.add(combined).draw();
}
```

**Render relationships** (new function):

```javascript
function renderRelationships() {
    if (!currentUserData || !currentUserData.relationships) return;
    
    const relationshipsCard = document.getElementById('relationships-card');
    relationshipsCard.style.display = 'block';
    
    const { mentionsGiven, mentionsReceived, reactionsGiven, reactionsReceived } = currentUserData.relationships;
    
    // Render mentions
    const mentionsViz = document.getElementById('mentions-viz');
    mentionsViz.innerHTML = `
        <div class="mb-2">
            <small class="fw-bold">Mentions Given:</small>
            ${renderRelationshipBars(mentionsGiven, 'primary')}
        </div>
        <div>
            <small class="fw-bold">Mentions Received:</small>
            ${renderRelationshipBars(mentionsReceived, 'success')}
        </div>
    `;
    
    // Render reactions
    const reactionsViz = document.getElementById('reactions-viz');
    reactionsViz.innerHTML = `
        <div class="mb-2">
            <small class="fw-bold">Reactions Given:</small>
            ${renderRelationshipBars(reactionsGiven, 'info')}
        </div>
        <div>
            <small class="fw-bold">Reactions Received:</small>
            ${renderRelationshipBars(reactionsReceived, 'warning')}
        </div>
    `;
}

function renderRelationshipBars(data, colorClass) {
    if (!data || data.length === 0) {
        return '<div class="text-muted small">No data</div>';
    }
    
    const maxCount = Math.max(...data.map(d => d.count));
    
    return data.slice(0, 5).map(item => {
        const percentage = (item.count / maxCount) * 100;
        return `
            <div class="relationship-bar">
                <div class="label">${item.user}</div>
                <div class="bar-container">
                    <div class="bar-fill bg-${colorClass}" style="width: ${percentage}%">
                        ${item.count}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
```

**Update word cloud modal** (modify `openWordCloudModal`):

```javascript
// When opening word cloud modal, use current view mode data
function openWordCloudModal() {
    // Use currentUserData if in user mode, otherwise use rawData
    // Update getCloudData() to check currentViewMode
}
```

**Helper functions**:

```javascript
function showUserLoadingStatus(show) {
    const statusDiv = document.getElementById('user-load-status');
    statusDiv.style.display = show ? 'block' : 'none';
}

function renderUserSummary() {
    // Update navbar badges with user-specific stats
    document.getElementById('badge-messages').innerHTML = 
        `Messages: ${currentUserData.stats.messageCount.toLocaleString()} (User: ${currentUserData.displayName})`;
    
    // Keep other badges as global or hide them
}
```

## Part 3: Efficiency & UX Optimizations

### Loading Indicators

1. **User data fetch**: Show spinner in filter section while loading
2. **Chart updates**: Brief loading state during re-render
3. **Word cloud**: Existing loading overlay applies

### Caching Strategy

- Store loaded user data in `loadedUsers` object
- Only fetch each user once per session
- Clear cache on page refresh (no persistence needed)

### Error Handling

- Catch fetch errors, show alert, reset to global view
- Validate user file exists before attempting load
- Graceful fallback if relationship data missing

### Performance Considerations

- Keep user JSON files reasonable size (target <500KB per user)
- Limit phrase output to top 200 in preprocessing
- Only render top 5 relationships (not all)
- Debounce/throttle any rapid filter changes

## Part 4: .gitignore Updates

**Add user data directory to .gitignore**:

```
# User-specific data files (generated)
/data/users/*.json
```

Keep the directory structure but ignore generated files.

## Implementation Order

1. **Save plan** - Write this plan to user_build_plan.md
2. **Preprocessing first** - Update preprocess.py, run it, verify user JSON files generated correctly
3. **Backend data structure** - Ensure per-user files have all needed data
4. **Frontend wiring** - Add user filter, loading logic, caching
5. **User table modification** - Change to show only selected user in user mode
6. **Visualization updates** - Update chart/table/cloud to use current view mode
7. **Relationships** - Add relationship section and visualizations
8. **Polish** - Loading states, error handling, responsive design

## Testing Checklist

- [ ] User files generated for all users in preprocessing
- [ ] User dropdown populates correctly
- [ ] Selecting user loads their data file
- [ ] All visualizations update (chart, table, word cloud)
- [ ] Relationships render correctly
- [ ] Reset to global view works
- [ ] Caching works (second load instant)
- [ ] Error handling for missing files
- [ ] Loading indicators show appropriately
- [ ] Mobile responsive layout maintained

