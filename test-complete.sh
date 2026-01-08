# 1. Test redirect in browser
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyNGQxMjVlZi05YmFmLTQyMTktOWZlZi1lZmY3MGMxY2YxZjciLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjAyMDIyMDcsImV4cCI6MTc2MDgwNzAwN30.y1M5Zt3nsFrjBWMSX1tStW1VkQX5sJrZdoAMG8-Ryds"


open http://localhost:3000/EpK2f0Cr
# Should redirect to Google!

# 2. Generate some clicks
for i in {1..5}; do
  curl -s http://localhost:3000/EpK2f0Cr > /dev/null
  echo "Click $i recorded"
done

# 3. Check click count
curl http://localhost:3000/api/links/EpK2f0Cr \
  -H "Authorization: Bearer $TOKEN" | jq '.data.click_count'

# Should show: 5 (or more if you clicked in browser)

# 4. See click details
curl http://localhost:3000/api/links/EpK2f0Cr \
  -H "Authorization: Bearer $TOKEN" | jq '.data.recent_clicks'

# 5. Verify in database
psql -U shortlink -d shortlink_dev -c "
  SELECT 
    l.short_code,
    l.original_url,
    l.click_count,
    COUNT(c.id) as actual_clicks
  FROM links l
  LEFT JOIN clicks c ON c.link_id = l.id
  WHERE l.short_code = 'EpK2f0Cr'
  GROUP BY l.id;
"
