import json
import os
import bcrypt
import psycopg
from typing import Dict, Any, Optional
import jwt
from datetime import datetime, timedelta

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Business: User authentication and registration system
    Args: event with httpMethod, body containing username/password
    Returns: JWT token for successful auth, error for failures
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
        body_data = json.loads(event.get('body', '{}'))
        action = body_data.get('action')  # 'login' or 'register'
        username = body_data.get('username', '').strip()
        password = body_data.get('password', '')
        
        if not username or not password:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Username and password required'})
            }
        
        if len(username) < 3 or len(username) > 50:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Username must be 3-50 characters'})
            }
            
        if len(password) < 6:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Password must be at least 6 characters'})
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
                if action == 'register':
                    # Check if username exists
                    cur.execute("SELECT id FROM users WHERE username = %s", (username,))
                    if cur.fetchone():
                        return {
                            'statusCode': 409,
                            'headers': {'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Username already exists'})
                        }
                    
                    # Hash password and create user
                    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                    cur.execute(
                        "INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id, is_admin",
                        (username, password_hash)
                    )
                    result = cur.fetchone()
                    user_id, is_admin = result[0], result[1]
                    
                elif action == 'login':
                    # Get user data
                    cur.execute("SELECT id, password_hash, is_admin FROM users WHERE username = %s", (username,))
                    result = cur.fetchone()
                    
                    if not result:
                        return {
                            'statusCode': 401,
                            'headers': {'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Invalid credentials'})
                        }
                    
                    user_id, stored_hash, is_admin = result[0], result[1], result[2]
                    
                    # Verify password
                    if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
                        return {
                            'statusCode': 401,
                            'headers': {'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Invalid credentials'})
                        }
                
                else:
                    return {
                        'statusCode': 400,
                        'headers': {'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Invalid action. Use login or register'})
                    }
                
                # Generate JWT token
                token_payload = {
                    'user_id': user_id,
                    'username': username,
                    'is_admin': is_admin,
                    'exp': datetime.utcnow() + timedelta(days=7),
                    'iat': datetime.utcnow()
                }
                
                # Use a simple secret for JWT (in production, use a proper secret)
                jwt_secret = 'rng_game_secret_key_2024'
                token = jwt.encode(token_payload, jwt_secret, algorithm='HS256')
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({
                        'token': token,
                        'user': {
                            'id': user_id,
                            'username': username,
                            'is_admin': is_admin
                        },
                        'message': f'Successfully {"registered" if action == "register" else "logged in"}'
                    })
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