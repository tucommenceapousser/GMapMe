let map;
let selectedLocation = null;

// Initialize map
function initMap() {
    map = L.map('map').setView([0, 0], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Get user's location
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            map.setView([lat, lng], 13);
            loadLandmarks(lat, lng);
        }, function() {
            console.error("Could not get location");
            loadLandmarks(0, 0);
        });
    }

    // Handle map clicks for adding new landmarks
    map.on('click', function(e) {
        selectedLocation = e.latlng;
        document.getElementById('submitBtn').disabled = false;
    });
}

// Load landmarks from API
async function loadLandmarks(lat, lng) {
    const response = await fetch(`/api/landmarks?lat=${lat}&lng=${lng}`);
    const landmarks = await response.json();
    
    landmarks.forEach(landmark => {
        const marker = L.marker([landmark.latitude, landmark.longitude], {
            icon: L.divIcon({
                className: `marker-${landmark.source}`,
                html: `<i class="fas fa-map-marker-alt"></i>`
            })
        });

        marker.bindPopup(`
            <h5>${landmark.name}</h5>
            <p>${landmark.description}</p>
            <small>Source: ${landmark.source}</small>
        `);

        marker.addTo(map);
    });
}

// Handle form submission
document.getElementById('landmarkForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!selectedLocation) return;

    const data = {
        name: document.getElementById('name').value,
        description: document.getElementById('description').value,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng
    };

    await fetch('/api/landmarks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    // Reload landmarks
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    loadLandmarks(selectedLocation.lat, selectedLocation.lng);

    // Reset form
    e.target.reset();
    selectedLocation = null;
    document.getElementById('submitBtn').disabled = true;
});

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', initMap);
