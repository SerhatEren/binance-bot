import sys
import json
import feedparser
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def fetch_news(rss_url):
    """Fetches news from the given RSS URL and returns a list of entries."""
    try:
        logging.info(f"Fetching news from: {rss_url}")
        feed = feedparser.parse(rss_url)

        if feed.bozo:
            logging.warning(f"Bozo feed detected (potentially malformed): {feed.bozo_exception}")
            # Continue processing if possible, might just be minor issues

        news_items = []
        if feed.entries:
            for entry in feed.entries:
                news_items.append({
                    'title': entry.get('title', 'N/A'),
                    'summary': entry.get('summary', 'N/A'),
                    'link': entry.get('link', 'N/A'),
                    'published': entry.get('published', 'N/A') # Or published_parsed
                })
            logging.info(f"Successfully fetched {len(news_items)} news items.")
        else:
            logging.warning("No entries found in the RSS feed.")

        return news_items

    except Exception as e:
        logging.error(f"Error fetching or parsing RSS feed {rss_url}: {e}", exc_info=True)
        return [] # Return empty list on error

if __name__ == "__main__":
    # Default URL, can be overridden by command-line argument in the future if needed
    default_rss_url = "https://www.hurriyet.com.tr/rss/ekonomi/"
    target_url = sys.argv[1] if len(sys.argv) > 1 else default_rss_url

    news_data = fetch_news(target_url)

    # Output the result as JSON to stdout
    print(json.dumps(news_data)) 