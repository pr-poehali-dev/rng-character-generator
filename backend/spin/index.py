import json
import os
import psycopg
from typing import Dict, Any
import jwt
import random
from datetime import datetime, timedelta

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Business: Character spinning/gacha system with cooldown and rarity mechanics
    Args: event with httpMethod, headers containing Authorization token
    Returns: Spin result with character obtained or cooldown error
    """
    method = event.get('httpMethod', 'GET')
    
    # Handle CORS OPTIONS request
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        # Get and verify JWT token
        headers = event.get('headers', {})
        auth_header = headers.get('authorization') or headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'No valid authorization token provided'})
            }
        
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        jwt_secret = 'rng_game_secret_key_2024'
        
        try:
            payload = jwt.decode(token, jwt_secret, algorithms=['HS256'])
            user_id = payload.get('user_id')
            username = payload.get('username')
        except jwt.InvalidTokenError:
            return {
                'statusCode': 401,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid or expired token'})
            }
        
        database_url = os.environ.get('DATABASE_URL')
        if not database_url:
            return {
                'statusCode': 500,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Database connection not configured'})
            }
        
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                # Check user's last spin time (1 hour cooldown)
                cur.execute("SELECT last_spin, total_spins FROM users WHERE id = %s", (user_id,))
                result = cur.fetchone()
                
                if not result:
                    return {
                        'statusCode': 404,
                        'headers': {'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'User not found'})
                    }
                
                last_spin, total_spins = result[0], result[1] or 0
                now = datetime.utcnow()
                
                # Check cooldown (1 hour = 3600 seconds)
                if last_spin:
                    time_diff = now - last_spin
                    if time_diff < timedelta(hours=1):
                        remaining = timedelta(hours=1) - time_diff
                        remaining_minutes = int(remaining.total_seconds() / 60)
                        return {
                            'statusCode': 429,
                            'headers': {'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({
                                'error': 'Spin cooldown active',
                                'remaining_minutes': remaining_minutes,
                                'next_spin_available': (now + remaining).isoformat()
                            })
                        }
                
                # Get all active characters with rarities
                cur.execute("""
                    SELECT c.id, c.name, c.description, c.image_url, c.is_limited, c.limited_until,
                           r.name as rarity_name, r.color as rarity_color, r.chance
                    FROM characters c
                    JOIN rarities r ON c.rarity_id = r.id
                    WHERE c.is_active = true 
                    AND (c.is_limited = false OR c.limited_until > %s)
                    ORDER BY r.chance DESC
                """, (now,))
                
                characters = cur.fetchall()
                
                if not characters:
                    return {
                        'statusCode': 404,
                        'headers': {'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'No characters available for spinning'})
                    }
                
                # Perform weighted random selection based on rarity chances
                total_weight = sum(char[8] for char in characters)  # char[8] is chance
                random_value = random.random() * total_weight
                
                current_weight = 0
                selected_character = None
                
                for char in characters:
                    current_weight += char[8]  # char[8] is chance
                    if random_value <= current_weight:
                        selected_character = char
                        break
                
                if not selected_character:
                    selected_character = characters[-1]  # Fallback to last character
                
                char_id, char_name, char_desc, char_image, is_limited, limited_until, rarity_name, rarity_color, chance = selected_character
                
                # Add character to user's collection
                cur.execute("""
                    INSERT INTO user_characters (user_id, character_id)
                    VALUES (%s, %s)
                """, (user_id, char_id))
                
                # Update user's spin count and last spin time
                cur.execute("""
                    UPDATE users 
                    SET last_spin = %s, total_spins = %s
                    WHERE id = %s
                """, (now, total_spins + 1, user_id))
                
                # Update daily quest progress for spins
                cur.execute("""
                    INSERT INTO user_quest_progress (user_id, quest_id, current_progress, quest_date)
                    SELECT %s, dq.id, 1, CURRENT_DATE
                    FROM daily_quests dq
                    WHERE dq.quest_type = 'daily_spins' AND dq.is_active = true
                    ON CONFLICT (user_id, quest_id, quest_date)
                    DO UPDATE SET current_progress = user_quest_progress.current_progress + 1
                """, (user_id,))
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({
                        'success': True,
                        'character': {
                            'id': char_id,
                            'name': char_name,
                            'description': char_desc,
                            'image_url': char_image,
                            'is_limited': is_limited,
                            'limited_until': limited_until.isoformat() if limited_until else None,
                            'rarity': {
                                'name': rarity_name,
                                'color': rarity_color,
                                'chance': float(chance)
                            }
                        },
                        'total_spins': total_spins + 1,
                        'next_spin_available': (now + timedelta(hours=1)).isoformat()
                    })
                }
                
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Server error: {str(e)}'})
        }