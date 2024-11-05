let map;
let selectedLocation = null;
let markers = [];

// Define fallback marker options
const fallbackMarkerOptions = {
    radius: 8,
    fillColor: "#3388ff",
    color: "#fff",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

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
                        <div style="width: 20px; height: 20px; background-color: #4A90E2; border-radius: 50%;"></div>
                        <span class="ms-2">User Added</span>
                    </div>
                    <div class="d-flex align-items-center">
                        <div style="width: 20px; height: 20px; background-color: #E74C3C; border-radius: 50%;"></div>
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
        }, function(error) {
            console.error("Could not get location:", error.message);
            // Default to a central location (e.g., Paris) if location access denied
            map.setView([48.8566, 2.3522], 13);
            loadLandmarks(48.8566, 2.3522);
        }, {
            timeout: 5000,
            enableHighAccuracy: true
        });
    } else {
        console.error("Geolocation not supported");
        map.setView([48.8566, 2.3522], 13);
        loadLandmarks(48.8566, 2.3522);
    }

    // Handle map clicks for adding new landmarks
    map.on('click', function(e) {
        selectedLocation = e.latlng;
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    });
}

// Create marker with popup
function createMarker(landmark) {
    let marker;
    const isWikipedia = landmark.source === 'wikipedia';
    
    try {
        // Define custom icons for different sources
        const icons = {
            wikipedia: {
                options: {
                    radius: 8,
                    fillColor: "#E74C3C",  // Red for Wikipedia
                    color: "#fff",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }
            },
            user: {
                options: {
                    radius: 8,
                    fillColor: "#4A90E2",  // Blue for user-added
                    color: "#fff",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }
            }
        };

        // Create circular marker with appropriate style
        marker = L.circleMarker(
            [landmark.latitude, landmark.longitude],
            icons[landmark.source].options
        );
    } catch (error) {
        console.error('Error creating marker:', error);
        // Use fallback marker if custom styling fails
        marker = L.circleMarker(
            [landmark.latitude, landmark.longitude],
            fallbackMarkerOptions
        );
    }

    let popupContent = `
        <div class="popup-content">
            <h5>${landmark.name}</h5>
            <p>${landmark.description}</p>
            <small class="text-muted">Source: ${landmark.source}</small>
    `;

    if (landmark.added_by) {
        popupContent += `<br><small class="text-muted">Added by: ${landmark.added_by}</small>`;
    }

    popupContent += '</div>';
    marker.bindPopup(popupContent);

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
const form = document.getElementById('landmarkForm');
if (form) {
    form.addEventListener('submit', async function(e) {
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
                if (response.status === 401) {
                    window.location.href = '/google_login';
                    return;
                }
                throw new Error('Failed to add landmark');
            }

            // Reload landmarks to get the updated list with user information
            loadLandmarks(selectedLocation.lat, selectedLocation.lng);

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
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', initMap);
