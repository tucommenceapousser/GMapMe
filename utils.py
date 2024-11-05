import requests

def get_wikipedia_landmarks(lat, lng, radius=10000):
    """
    Fetch nearby landmarks from Wikipedia's API
    """
    endpoint = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "list": "geosearch",
        "gscoord": f"{lat}|{lng}",
        "gsradius": radius,
        "gslimit": 10
    }
    
    response = requests.get(endpoint, params=params)
    data = response.json()
    
    landmarks = []
    for place in data.get('query', {}).get('geosearch', []):
        landmarks.append({
            'title': place['title'],
            'lat': place['lat'],
            'lng': place['lon'],
            'description': get_wikipedia_extract(place['pageid'])
        })
    
    return landmarks

def get_wikipedia_extract(page_id):
    """
    Get the extract (short description) of a Wikipedia page
    """
    endpoint = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "prop": "extracts",
        "exintro": True,
        "explaintext": True,
        "pageids": page_id
    }
    
    response = requests.get(endpoint, params=params)
    data = response.json()
    
    return data['query']['pages'][str(page_id)]['extract']
