let map;
let selectedLocation = null;
let markers = [];

// Initialize map
function initMap() {
    map = L.map('map').setView([0, 0], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add legend
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
            <div class="card bg-dark">
                <div class="card-body p-2">
                    <h6 class="card-title mb-2">Legend</h6>
                    <div class="d-flex align-items-center mb-1">
                        <img src="/static/icons/blue-marker.png" alt="User" style="width: 20px; height: 20px;">
                        <span class="ms-2">User Added</span>
                    </div>
                    <div class="d-flex align-items-center">
                        <img src="/static/icons/red-marker.png" alt="Wikipedia" style="width: 20px; height: 20px;">
                        <span class="ms-2">Wikipedia</span>
                    </div>
                </div>
            </div>
        `;
        return div;
    };
    legend.addTo(map);

    // Get user's location
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            map.setView([lat, lng], 13);
            loadLandmarks(lat, lng);
        }, function() {
            console.error("Could not get location");
            map.setView([40.7128, -74.0060], 13); // Default to New York if location access denied
            loadLandmarks(40.7128, -74.0060);
        });
    }

    // Handle map clicks for adding new landmarks
    map.on('click', function(e) {
        selectedLocation = e.latlng;
        document.getElementById('submitBtn').disabled = false;
    });
}

// Create marker with popup
function createMarker(landmark) {
    // Define custom icons for different sources
    const icons = {
        wikipedia: L.icon({
            iconUrl: '/static/icons/red-marker.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        }),
        user: L.icon({
            iconUrl: '/static/icons/blue-marker.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        })
    };

    const marker = L.marker([landmark.latitude, landmark.longitude], {
        icon: icons[landmark.source]
    });

    marker.bindPopup(`
        <div class="popup-content">
            <h5>${landmark.name}</h5>
            <p>${landmark.description}</p>
            <small class="text-muted">Source: ${landmark.source}</small>
        </div>
    `);

    markers.push(marker);
    return marker;
}

// Clear all markers
function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

// Load landmarks from API
async function loadLandmarks(lat, lng) {
    try {
        const response = await fetch(`/api/landmarks?lat=${lat}&lng=${lng}`);
        if (!response.ok) {
            throw new Error('Failed to fetch landmarks');
        }
        
        const landmarks = await response.json();
        clearMarkers();
        
        landmarks.forEach(landmark => {
            const marker = createMarker(landmark);
            marker.addTo(map);
        });
    } catch (error) {
        console.error('Error loading landmarks:', error);
        showAlert('error', 'Failed to load landmarks');
    }
}

// Show alert message
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.querySelector('.col-md-3').insertBefore(alertDiv, document.querySelector('.card'));
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Handle form submission
document.getElementById('landmarkForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!selectedLocation) return;

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';

    const data = {
        name: document.getElementById('name').value,
        description: document.getElementById('description').value,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng
    };

    try {
        const response = await fetch('/api/landmarks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to add landmark');
        }

        // Immediately add the new marker
        const newLandmark = {
            ...data,
            source: 'user'
        };
        const marker = createMarker(newLandmark);
        marker.addTo(map);

        // Show success message
        showAlert('success', 'Landmark added successfully!');

        // Reset form
        e.target.reset();
        selectedLocation = null;
    } catch (error) {
        console.error('Error adding landmark:', error);
        showAlert('danger', 'Failed to add landmark');
    } finally {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Add Landmark';
    }
});

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', initMap);
