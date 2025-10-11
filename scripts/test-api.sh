#!/bin/bash

BASE_URL="http://localhost:3000"

echo "Testing ShortLink API..."
echo ""

# Test 1: Health Check
echo "1. Health Check"
curl -s $BASE_URL/health | jq
echo ""

# Test 2: Register User
echo "2. Register User"
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "name": "Test User"
  }')
echo $REGISTER_RESPONSE | jq
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token')
echo "Token: $TOKEN"
echo ""

# Test 3: Create Link
echo "3. Create Short Link"
CREATE_RESPONSE=$(curl -s -X POST $BASE_URL/api/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "url": "https://www.example.com"
  }')
echo $CREATE_RESPONSE | jq
SHORT_CODE=$(echo $CREATE_RESPONSE | jq -r '.data.short_code')
echo "Short Code: $SHORT_CODE"
echo ""

# Test 4: Get User Links
echo "4. Get User Links"
curl -s $BASE_URL/api/links \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# Test 5: Test Redirect
echo "5. Test Redirect"
curl -I $BASE_URL/$SHORT_CODE
echo ""

echo "All tests completed!"
