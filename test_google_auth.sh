#!/bin/bash

echo "==================================="
echo "Google OAuth Authentication Test"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Checking Backend Service${NC}"
BACKEND_STATUS=$(curl -s http://localhost:8001/api/health)
if [[ $BACKEND_STATUS == *"ok"* ]]; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not responding${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 2: Checking Frontend Service${NC}"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$FRONTEND_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${RED}✗ Frontend is not responding${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 3: Checking Google OAuth Configuration${NC}"
if [ -f "/app/backend/.env" ]; then
    if grep -q "GOOGLE_CLIENT_ID" /app/backend/.env && grep -q "GOOGLE_CLIENT_SECRET" /app/backend/.env; then
        echo -e "${GREEN}✓ Google OAuth credentials configured${NC}"
        echo "   Client ID: $(grep GOOGLE_CLIENT_ID /app/backend/.env | cut -d'=' -f2 | cut -c1-30)..."
        echo "   Callback URL: $(grep GOOGLE_CALLBACK_URL /app/backend/.env | cut -d'=' -f2)"
    else
        echo -e "${RED}✗ Google OAuth credentials missing${NC}"
    fi
else
    echo -e "${RED}✗ Backend .env file not found${NC}"
fi
echo ""

echo -e "${YELLOW}Step 4: Checking User Data Structure${NC}"
if [ -f "/app/backend/data/users.json" ]; then
    echo -e "${GREEN}✓ Users file exists${NC}"
    
    # Check if any user has Google connection
    if grep -q "googleId" /app/backend/data/users.json; then
        echo -e "${GREEN}✓ At least one user has Google connection${NC}"
        echo ""
        echo "Users with Google connection:"
        cat /app/backend/data/users.json | python3 -c "
import sys, json
users = json.load(sys.stdin)
for user in users:
    if user.get('googleId'):
        print(f\"  - {user.get('name', user.get('username', 'Unknown'))} ({user.get('email', 'no email')})\")
        print(f\"    Google ID: {user.get('googleId')[:20]}...\")
        print(f\"    Picture: {'Yes' if user.get('picture') else 'No'}\")
        print(f\"    Has Access Token: {'Yes' if user.get('googleAccessToken') else 'No'}\")
        print(f\"    Has Refresh Token: {'Yes' if user.get('googleRefreshToken') else 'No'}\")
" 2>/dev/null || echo "  (Unable to parse user data)"
    else
        echo -e "${YELLOW}⚠ No users with Google connection yet${NC}"
        echo "  → Login with Google to test"
    fi
else
    echo -e "${RED}✗ Users file not found${NC}"
fi
echo ""

echo -e "${YELLOW}Step 5: Checking Recent Backend Logs${NC}"
echo "Last 5 lines from backend log:"
tail -n 5 /var/log/supervisor/backend.out.log
echo ""

echo -e "${YELLOW}Step 6: Manual Testing Instructions${NC}"
echo ""
echo "To test Google OAuth authentication:"
echo ""
echo "1. Open your browser and navigate to the app"
echo "2. Click 'Sign in with Google'"
echo "3. Complete Google authentication"
echo "4. After redirect, check the dashboard:"
echo "   - Profile button should show your Google profile picture"
echo "   - Click profile → Should show 'Google Account' badge"
echo "   - Should show '* Connected to Google Drive'"
echo ""
echo "5. Open browser console (F12) and look for:"
echo "   - 'AuthContext - User has googleId: true'"
echo "   - 'Dashboard - User has Google connection: true'"
echo ""
echo "6. Test sync functionality:"
echo "   - Click 'Backup to Drive' → Should sync without re-authentication"
echo "   - Click 'Restore from Drive' → Should work without re-authentication"
echo ""

echo -e "${GREEN}==================================="
echo "Test Complete!"
echo "===================================${NC}"
echo ""
echo "For detailed information, see: /app/GOOGLE_AUTH_FIX_SUMMARY.md"
