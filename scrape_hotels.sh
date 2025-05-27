#!/bin/bash

# Make the HTTP request to our endpoint
curl -X POST http://localhost:3002/api/scrape-popular-cities \
  -H "Content-Type: application/json" \
  -d '{}'

# Log the execution time
echo "Scraping job executed at $(date)" >> /var/log/hotel_scraper.log 