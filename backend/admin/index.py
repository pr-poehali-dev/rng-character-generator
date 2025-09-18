import json
import os
import psycopg
from typing import Dict, Any
import jwt
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Business: Admin panel for creating characters, rarities and managing events
    Args: event with httpMethod, headers with auth token, body with admin actions
    Returns: Success/error response for admin operations
    """
    method = event.get('httpMethod', 'GET')
    
    # Handle CORS OPTIONS request
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        # Verify admin authentication
        headers = event.get('headers', {})
        auth_header = headers.get('authorization') or headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'No valid authorization token provided'})
            }
        
        token = auth_header[7:]
        jwt_secret = 'rng_game_secret_key_2024'
        
        try:
            payload = jwt.decode(token, jwt_secret, algorithms=['HS256'])
            user_id = payload.get('user_id')
            is_admin = payload.get('is_admin', False)
            
            if not is_admin:
                return {
                    'statusCode': 403,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Admin access required'})
                }
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
                if method == 'GET':
                    # Get all characters and rarities for admin view
                    cur.execute("""
                        SELECT c.id, c.name, c.description, c.image_url, c.is_limited, c.limited_until,
                               c.is_active, r.name as rarity_name, r.color as rarity_color
                        FROM characters c
                        JOIN rarities r ON c.rarity_id = r.id
                        ORDER BY c.created_at DESC
                    """)
                    characters = cur.fetchall()
                    
                    cur.execute("SELECT id, name, color, chance FROM rarities ORDER BY chance DESC")
                    rarities = cur.fetchall()
                    
                    return {
                        'statusCode': 200,
                        'headers': {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        },
                        'body': json.dumps({
                            'characters': [
                                {
                                    'id': char[0],
                                    'name': char[1],
                                    'description': char[2],
                                    'image_url': char[3],
                                    'is_limited': char[4],
                                    'limited_until': char[5].isoformat() if char[5] else None,
                                    'is_active': char[6],
                                    'rarity': {'name': char[7], 'color': char[8]}
                                } for char in characters
                            ],
                            'rarities': [
                                {
                                    'id': r[0],
                                    'name': r[1], 
                                    'color': r[2],
                                    'chance': float(r[3])
                                } for r in rarities
                            ]
                        })
                    }
                
                elif method == 'POST':
                    body_data = json.loads(event.get('body', '{}'))
                    action = body_data.get('action')
                    
                    if action == 'create_character':
                        name = body_data.get('name', '').strip()
                        description = body_data.get('description', '').strip()
                        image_url = body_data.get('image_url', '').strip()
                        rarity_id = body_data.get('rarity_id')
                        is_limited = body_data.get('is_limited', False)
                        limited_until = body_data.get('limited_until')
                        
                        if not name or not rarity_id:
                            return {
                                'statusCode': 400,
                                'headers': {'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Name and rarity_id are required'})
                            }
                        
                        # Parse limited_until if provided
                        limited_until_dt = None
                        if is_limited and limited_until:
                            try:
                                limited_until_dt = datetime.fromisoformat(limited_until.replace('Z', '+00:00'))
                            except ValueError:
                                return {
                                    'statusCode': 400,
                                    'headers': {'Access-Control-Allow-Origin': '*'},
                                    'body': json.dumps({'error': 'Invalid limited_until format. Use ISO format'})
                                }
                        
                        cur.execute("""
                            INSERT INTO characters (name, description, image_url, rarity_id, is_limited, limited_until, created_by)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            RETURNING id
                        """, (name, description, image_url, rarity_id, is_limited, limited_until_dt, user_id))
                        
                        character_id = cur.fetchone()[0]
                        
                        return {
                            'statusCode': 201,
                            'headers': {
                                'Access-Control-Allow-Origin': '*',
                                'Content-Type': 'application/json'
                            },
                            'body': json.dumps({
                                'success': True,
                                'character_id': character_id,
                                'message': f'Character "{name}" created successfully'
                            })
                        }
                    
                    elif action == 'create_rarity':
                        name = body_data.get('name', '').strip()
                        color = body_data.get('color', '').strip()
                        chance = body_data.get('chance')
                        
                        if not name or not color or chance is None:
                            return {
                                'statusCode': 400,
                                'headers': {'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Name, color and chance are required'})
                            }
                        
                        try:
                            chance = float(chance)
                            if chance < 0 or chance > 1:
                                raise ValueError("Chance must be between 0 and 1")
                        except ValueError:
                            return {
                                'statusCode': 400,
                                'headers': {'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Chance must be a number between 0 and 1'})
                            }
                        
                        cur.execute("""
                            INSERT INTO rarities (name, color, chance)
                            VALUES (%s, %s, %s)
                            RETURNING id
                        """, (name, color, chance))
                        
                        rarity_id = cur.fetchone()[0]
                        
                        return {
                            'statusCode': 201,
                            'headers': {
                                'Access-Control-Allow-Origin': '*',
                                'Content-Type': 'application/json'
                            },
                            'body': json.dumps({
                                'success': True,
                                'rarity_id': rarity_id,
                                'message': f'Rarity "{name}" created successfully'
                            })
                        }
                    
                    else:
                        return {
                            'statusCode': 400,
                            'headers': {'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Invalid action'})
                        }
                
                else:
                    return {
                        'statusCode': 405,
                        'headers': {'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Method not allowed'})
                    }
                    
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Server error: {str(e)}'})
        }