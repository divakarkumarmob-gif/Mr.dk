// Production search service using Tavily
export async function performSearch(query: string) {
    const apiKey = process.env.SEARCH_API_KEY;
    if (!apiKey) {
        console.error("SEARCH_API_KEY not set.");
        return [];
    }

    try {
        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: apiKey,
                query: query,
                search_depth: "advanced", // Get more depth
                max_results: 5,           // Get more results
            }),
        });

        const data = await response.json();
        // Return array of results with title, url, and content (scraped snippet)
        return data.results || [];
    } catch (error) {
        console.error("Search API Error:", error);
        return [];
    }
}
