import json
import os
import re
from datetime import datetime
from collections import defaultdict, Counter
from pathlib import Path

# Comprehensive stop words list
STOP_WORDS = set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 
    'by', 'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 
    'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 
    'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 
    'its', 'itself', 'just', 'me', 'might', 'more', 'most', 'must', 'my', 'myself', 'no', 
    'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 
    'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 
    'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 
    'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 
    'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 
    'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
    # Additional common words
    'im', 'ive', 'dont', 'doesnt', 'didnt', 'wont', 'wouldnt', 'cant', 'couldnt', 'shouldnt',
    'isnt', 'arent', 'wasnt', 'werent', 'hasnt', 'havent', 'hadnt', 'theyre', 'theres',
    'ill', 'youre', 'youll', 'youve', 'hes', 'shes', 'its', 'were', 'weve', 'theyll',
    'thats', 'whats', 'whos', 'hows', 'wheres', 'theres',
    # Additional filtered words
    'also', 'don', 'even', 'get', 'goou', 'know', 'like', 'lol', 'make', 'need', 
    'really', 'right', 'see', 'something', 'still', 'sure', 'thing', 'way', 'well', 'yeah'
])

def clean_text(text):
    """Clean and normalize text for word extraction"""
    if not text:
        return ""
    # Convert to lowercase
    text = text.lower()
    # Remove URLs
    text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
    # Remove mentions
    text = re.sub(r'<@!?\d+>', '', text)
    # Remove custom emojis
    text = re.sub(r'<:[a-zA-Z0-9_]+:\d+>', '', text)
    # Keep only letters, numbers, and spaces
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_words(text):
    """Extract words from text, excluding stop words"""
    words = clean_text(text).split()
    return [w for w in words if w and w not in STOP_WORDS and len(w) > 1]

def extract_phrases(text, min_length=2, max_length=6):
    """Extract n-gram phrases from text"""
    words = clean_text(text).split()
    # Filter out very short words and stop words for phrase building
    words = [w for w in words if w and len(w) > 1]
    
    phrases = []
    for n in range(min_length, min(max_length + 1, len(words) + 1)):
        for i in range(len(words) - n + 1):
            phrase = ' '.join(words[i:i+n])
            # Skip phrases that are only stop words
            phrase_words = phrase.split()
            if any(w not in STOP_WORDS for w in phrase_words):
                phrases.append(phrase)
    
    return phrases

def get_display_name(author):
    """Get the display name for a user (nickname or username)"""
    return author.get('nickname') or author.get('name', 'Unknown')

def parse_timestamp(ts_str):
    """Parse ISO timestamp to datetime"""
    try:
        # Handle ISO format with timezone
        return datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
    except:
        return None

def build_user_timeline(messages):
    """Build timeline data for a specific user's messages"""
    daily_counts = defaultdict(int)
    
    for msg in messages:
        timestamp = parse_timestamp(msg.get('timestamp', ''))
        if timestamp:
            date_key = timestamp.strftime('%Y-%m-%d')
            daily_counts[date_key] += 1
    
    timeline = {
        'daily': [],
        'weekly': {},
        'monthly': {}
    }
    
    # Daily timeline
    for date_str in sorted(daily_counts.keys()):
        timeline['daily'].append({
            'date': date_str,
            'count': daily_counts[date_str]
        })
    
    # Weekly and monthly aggregation
    for date_str, count in daily_counts.items():
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        week_key = dt.strftime('%Y-W%U')
        timeline['weekly'][week_key] = timeline['weekly'].get(week_key, 0) + count
        month_key = dt.strftime('%Y-%m')
        timeline['monthly'][month_key] = timeline['monthly'].get(month_key, 0) + count
    
    # Convert to sorted lists
    timeline['weekly'] = [{'week': k, 'count': v} for k, v in sorted(timeline['weekly'].items())]
    timeline['monthly'] = [{'month': k, 'count': v} for k, v in sorted(timeline['monthly'].items())]
    
    return timeline

def export_user_data(user_id, user_data, messages, mentions_given, mentions_received, 
                     reactions_received, user_id_to_name):
    """Generate comprehensive per-user JSON data"""
    # Calculate per-user word and phrase counts
    user_word_counter = Counter()
    user_phrase_counter = Counter()
    
    for msg in messages:
        content = msg.get('content', '')
        words = extract_words(content)
        user_word_counter.update(words)
        
        phrases = extract_phrases(content)
        user_phrase_counter.update(phrases)
    
    # Build timeline for this user
    user_timeline = build_user_timeline(messages)
    
    # Resolve mention user IDs to display names
    def resolve_mentions(mention_counter):
        resolved = []
        for mentioned_id, count in mention_counter.most_common(10):
            # Resolve ID to name, fall back to ID if not found
            name = user_id_to_name.get(mentioned_id, f"User_{mentioned_id}")
            resolved.append({'user': name, 'count': count})
        return resolved
    
    mentions_given_resolved = resolve_mentions(mentions_given)
    mentions_received_resolved = resolve_mentions(mentions_received)
    
    # Note: Reactions given data is not available in Discord exports
    # We can only track reactions received
    reactions_received_list = []
    if reactions_received:
        # Group by user (Discord doesn't provide who gave reactions, only counts)
        # So we'll show total reactions received with emoji breakdown
        reactions_received_list = [
            {
                'emoji': emoji,
                'count': count
            }
            for emoji, count in reactions_received.get('emojiBreakdown', Counter()).most_common(10)
        ]
    
    return {
        'userId': user_id,
        'displayName': user_data['displayName'],
        'aliases': user_data.get('aliases', []),
        'stats': {
            'messageCount': user_data['messageCount'],
            'wordCount': user_data['wordCount'],
            'avgLength': user_data['avgLength'],
            'activityScore': user_data['activityScore'],
            'totalReactions': user_data['totalReactions']
        },
        'words': dict(user_word_counter.most_common()),  # All words, no limit
        'phrases': {k: v for k, v in user_phrase_counter.items() if v >= 3},  # Minimum 3 occurrences
        'timeline': user_timeline,
        'relationships': {
            'mentionsGiven': mentions_given_resolved,
            'mentionsReceived': mentions_received_resolved,
            'reactionsReceived': reactions_received_list
        }
    }

def process_data():
    """Main processing function"""
    print("Starting Discord data processing...")
    
    data_dir = Path('data/src')
    if not data_dir.exists():
        print("Error: 'data/src' folder not found!")
        return
    
    # Initialize data structures
    # Use user ID as key to properly track users even if they change nicknames
    user_stats = defaultdict(lambda: {
        'messageCount': 0,
        'wordCount': 0,
        'totalLength': 0,
        'displayNames': Counter()  # Track all display names with frequency
    })
    word_counter = Counter()
    phrase_counter = Counter()
    daily_counts = defaultdict(int)
    all_timestamps = []
    total_messages = 0
    
    # Track reactions received by each user
    user_reactions = defaultdict(lambda: {
        'totalReactions': 0,
        'emojiBreakdown': Counter()
    })
    
    # Per-user data structures for individual analysis
    user_messages = defaultdict(list)  # Store all messages per user
    user_mentions_given = defaultdict(Counter)  # Who each user mentions
    user_mentions_received = defaultdict(Counter)  # Who mentions each user
    
    # Build user ID to display name mapping for mention resolution
    user_id_to_name = {}
    
    # Process all JSON files
    json_files = list(data_dir.glob('*.json'))
    print(f"Found {len(json_files)} JSON files to process...")
    
    for json_file in json_files:
        print(f"Processing {json_file.name}...")
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            messages = data.get('messages', [])
            
            for msg in messages:
                # Skip bot messages
                author = msg.get('author', {})
                if author.get('isBot', False):
                    continue
                
                content = msg.get('content', '')
                if not content or not content.strip():
                    continue
                
                # Use user ID as key for consistent tracking
                user_id = author.get('id', 'unknown')
                display_name = get_display_name(author)
                
                # Build user ID to name mapping
                user_id_to_name[user_id] = display_name
                
                # Update user stats (keyed by ID, track all display names)
                words = extract_words(content)
                word_count = len(words)
                
                user_stats[user_id]['messageCount'] += 1
                user_stats[user_id]['wordCount'] += word_count
                user_stats[user_id]['totalLength'] += len(content)
                user_stats[user_id]['displayNames'][display_name] += 1  # Count name frequency
                
                # Store message for per-user analysis
                user_messages[user_id].append({
                    'content': content,
                    'timestamp': msg.get('timestamp', ''),
                    'reactions': msg.get('reactions', [])
                })
                
                # Extract and track mentions from Discord's mentions field
                mentions = msg.get('mentions', [])
                for mentioned_user in mentions:
                    mentioned_id = mentioned_user.get('id', '')
                    if mentioned_id and mentioned_id != user_id:  # Don't count self-mentions
                        user_mentions_given[user_id][mentioned_id] += 1
                        user_mentions_received[mentioned_id][user_id] += 1
                        # Ensure mentioned user exists in user_id_to_name mapping
                        if mentioned_id not in user_id_to_name:
                            mentioned_name = mentioned_user.get('nickname') or mentioned_user.get('name', 'Unknown')
                            user_id_to_name[mentioned_id] = mentioned_name
                
                # Track reactions received by message author
                reactions = msg.get('reactions', [])
                for reaction in reactions:
                    emoji_name = reaction.get('emoji', {}).get('name', '')
                    reaction_count = reaction.get('count', 0)
                    user_reactions[user_id]['totalReactions'] += reaction_count
                    user_reactions[user_id]['emojiBreakdown'][emoji_name] += reaction_count
                
                # Update word frequencies
                word_counter.update(words)
                
                # Extract and count phrases
                phrases = extract_phrases(content)
                phrase_counter.update(phrases)
                
                # Track timestamp for timeline
                timestamp = parse_timestamp(msg.get('timestamp', ''))
                if timestamp:
                    all_timestamps.append(timestamp)
                    date_key = timestamp.strftime('%Y-%m-%d')
                    daily_counts[date_key] += 1
                
                total_messages += 1
        
        except Exception as e:
            print(f"Error processing {json_file.name}: {e}")
            continue
    
    print(f"Processed {total_messages} total messages")
    
    # Calculate user averages and build user list
    # Now we strip the user IDs and only keep display names in final output
    users_list = []
    for user_id, stats in user_stats.items():
        avg_length = stats['totalLength'] / stats['messageCount'] if stats['messageCount'] > 0 else 0
        
        # Get most common display name and collect aliases
        display_names = stats['displayNames']
        most_common_name = display_names.most_common(1)[0][0] if display_names else 'Unknown'
        
        # Get other names (aliases) sorted by frequency
        aliases = [name for name, count in display_names.most_common() if name != most_common_name]
        
        # Calculate activity score
        activity_score = round((stats['messageCount'] * 0.3) + (stats['wordCount'] * 0.7), 2)
        
        users_list.append({
            'displayName': most_common_name,  # Most commonly used name
            'aliases': aliases,  # Other names they went by
            'messageCount': stats['messageCount'],
            'wordCount': stats['wordCount'],
            'avgLength': round(avg_length, 2),
            'activityScore': activity_score,
            'totalReactions': user_reactions[user_id]['totalReactions'],
            'emojiBreakdown': dict(user_reactions[user_id]['emojiBreakdown'].most_common())
        })
    
    # Sort users by activity score
    users_list.sort(key=lambda x: x['activityScore'], reverse=True)
    
    # Create user ID to user data mapping for export
    user_id_to_data = {}
    for user_id, stats in user_stats.items():
        # Find this user in users_list
        display_names = stats['displayNames']
        most_common_name = display_names.most_common(1)[0][0] if display_names else 'Unknown'
        user_data = next((u for u in users_list if u['displayName'] == most_common_name), None)
        if user_data:
            user_id_to_data[user_id] = user_data
    
    # Export per-user data files
    print("\nExporting per-user data files...")
    users_dir = Path('data/users')
    users_dir.mkdir(exist_ok=True)
    
    user_files_mapping = {}  # For global data reference
    
    for user_id, user_data in user_id_to_data.items():
        try:
            # Generate user data
            user_json = export_user_data(
                user_id=user_id,
                user_data=user_data,
                messages=user_messages[user_id],
                mentions_given=user_mentions_given[user_id],
                mentions_received=user_mentions_received[user_id],
                reactions_received=user_reactions[user_id],
                user_id_to_name=user_id_to_name
            )
            
            # Sanitize filename (remove special chars, handle conflicts)
            safe_name = re.sub(r'[^\w\-]', '_', user_data['displayName'])
            # Add user ID suffix to handle name conflicts
            safe_name = f"{safe_name}_{user_id[:8]}"
            filename = f"{safe_name}.json"
            output_path = users_dir / filename
            
            # Write user file
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(user_json, f, indent=2, ensure_ascii=False)
            
            # Store mapping
            user_files_mapping[user_data['displayName']] = f"data/users/{filename}"
            
        except Exception as e:
            print(f"Error exporting data for user {user_data.get('displayName', user_id)}: {e}")
            continue
    
    print(f"Exported {len(user_files_mapping)} user data files to {users_dir}/")
    
    # Filter phrases to minimum 20 occurrences
    filtered_phrases = {phrase: count for phrase, count in phrase_counter.items() if count >= 20}
    print(f"Found {len(filtered_phrases)} phrases with 20+ occurrences (from {len(phrase_counter)} total)")
    
    # Calculate date range
    date_range = {}
    if all_timestamps:
        all_timestamps.sort()
        date_range = {
            'start': all_timestamps[0].strftime('%Y-%m-%d'),
            'end': all_timestamps[-1].strftime('%Y-%m-%d')
        }
    
    # Build timeline data
    timeline = {
        'daily': [],
        'weekly': {},
        'monthly': {}
    }
    
    # Daily timeline
    for date_str in sorted(daily_counts.keys()):
        timeline['daily'].append({
            'date': date_str,
            'count': daily_counts[date_str]
        })
    
    # Weekly and monthly aggregation
    for date_str, count in daily_counts.items():
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        # Weekly (ISO week)
        week_key = dt.strftime('%Y-W%U')
        timeline['weekly'][week_key] = timeline['weekly'].get(week_key, 0) + count
        # Monthly
        month_key = dt.strftime('%Y-%m')
        timeline['monthly'][month_key] = timeline['monthly'].get(month_key, 0) + count
    
    # Convert weekly/monthly to sorted lists
    timeline['weekly'] = [{'week': k, 'count': v} for k, v in sorted(timeline['weekly'].items())]
    timeline['monthly'] = [{'month': k, 'count': v} for k, v in sorted(timeline['monthly'].items())]
    
    # Calculate overall average message length
    total_words = sum(stats['wordCount'] for stats in user_stats.values())
    avg_message_length = total_words / total_messages if total_messages > 0 else 0
    
    # Build final output
    output = {
        'summary': {
            'totalMessages': total_messages,
            'totalUsers': len(user_stats),
            'dateRange': date_range,
            'avgMessageLength': round(avg_message_length, 2)
        },
        'users': users_list,
        'words': dict(word_counter.most_common()),  # All words
        'phrases': filtered_phrases,
        'timeline': timeline,
        'userFiles': user_files_mapping  # Mapping of display names to file paths
    }
    
    # Write output
    output_file = 'data/processed-data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n=== Processing Complete ===")
    print(f"Output written to: {output_file}")
    print(f"Total messages: {total_messages:,}")
    print(f"Unique users: {len(user_stats):,}")
    print(f"Unique words: {len(word_counter):,}")
    print(f"Phrases (20+ occurrences): {len(filtered_phrases):,}")
    print(f"Date range: {date_range.get('start', 'N/A')} to {date_range.get('end', 'N/A')}")

if __name__ == '__main__':
    process_data()

