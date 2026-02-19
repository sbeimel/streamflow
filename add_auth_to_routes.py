#!/usr/bin/env python3
"""
Script to add @requires_auth decorator to all API routes in web_api.py
Excludes: /api/health, /api/version, /api/auth/test, /health
"""

import re

# Read the file
with open('backend/web_api.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Routes that should NOT have auth
EXCLUDED_ROUTES = [
    '/api/health',
    '/health',
    '/api/version',
    '/api/auth/test'
]

# Find all @app.route decorators
pattern = r'(@app\.route\(\'(/api/[^\']+)\'[^\)]*\)[^\n]*\n)(def [a-z_]+\([^\)]*\):)'

def should_add_auth(route_path):
    """Check if route should have auth added."""
    for excluded in EXCLUDED_ROUTES:
        if route_path == excluded:
            return False
    return True

def replace_route(match):
    """Add @requires_auth if not already present and route is not excluded."""
    decorator = match.group(1)
    route_path = match.group(2)
    func_def = match.group(4)
    
    # Check if already has @requires_auth
    if '@requires_auth' in decorator:
        return match.group(0)
    
    # Check if route should be excluded
    if not should_add_auth(route_path):
        return match.group(0)
    
    # Add @requires_auth before function definition
    return f"{decorator}@requires_auth\n{func_def}"

# Replace all routes
new_content = re.sub(pattern, replace_route, content)

# Write back
with open('backend/web_api.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✅ Added @requires_auth to all API routes (except excluded ones)")
