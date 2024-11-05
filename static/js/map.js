let map;
let selectedLocation = null;
let markers = [];

// Define category colors with neon values
const categoryColors = {
    historical: '#00ffff',    // Neon Cyan
    cultural: '#ff00ff',      // Neon Magenta
    natural: '#00ff00',       // Neon Green
    religious: '#ff00ff',     // Neon Purple
    entertainment: '#ffff00', // Neon Yellow
    wikipedia: '#ff0000'      // Neon Red
};

// Define fallback marker options with neon effect
const fallbackMarkerOptions = {
    radius: 8,
    fillColor: "#00ffff",
    color: "#fff",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8
};

// Initialize map with dark theme
function initMap() {
    map = L.map('map').setView([0, 0], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        className: 'dark-tiles'
    }).addTo(map);

    // Add legend
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
            <div class="card">
                <div class="card-body p-2">
                    <h6 class="card-title mb-2">Categories</h6>
                    ${Object.entries(categoryColors).map(([category, color]) => `
                        <div class="d-flex align-items-center mb-1">
                            <div style="width: 20px; height: 20px; background-color: ${color}; border-radius: 50%; box-shadow: 0 0 10px ${color};"></div>
                            <span class="ms-2">${category.charAt(0).toUpperCase() + category.slice(1)}</span>
                        </div>
                    `).join('')}
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
            console.log("Could not get location:", error.message);
            map.setView([48.8566, 2.3522], 13);  // Default location
            loadLandmarks(48.8566, 2.3522);
        }, {
            timeout: 5000,
            enableHighAccuracy: true
        });
    } else {
        console.log("Geolocation not supported");
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
        const markerColor = isWikipedia ? categoryColors.wikipedia : categoryColors[landmark.category || 'historical'];

        const markerOptions = {
            radius: 8,
            fillColor: markerColor,
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        };

        marker = L.circleMarker(
            [landmark.latitude, landmark.longitude],
            markerOptions
        );
    } catch (error) {
        console.error('Error creating marker:', error);
        marker = L.circleMarker(
            [landmark.latitude, landmark.longitude],
            fallbackMarkerOptions
        );
    }

    let popupContent = `
        <div class="popup-content">
            <h5>${landmark.name}</h5>
            <p>${landmark.description}</p>
    `;

    if (landmark.photo) {
        popupContent += `<img src="/static/uploads/${landmark.photo}" class="img-fluid mb-2" alt="${landmark.name}">`;
    }

    popupContent += `
            <small class="text-muted">
                Source: ${landmark.source}
                ${landmark.category ? `<br>Category: ${landmark.category}` : ''}
            </small>
    `;

    if (landmark.added_by) {
        popupContent += `<br><small class="text-muted">Added by: ${landmark.added_by}</small>`;
    }

    popupContent += '</div>';
    marker.bindPopup(popupContent);

    // Add hover effect
    marker.on('mouseover', function() {
        this.setStyle({
            fillOpacity: 1,
            weight: 3
        });
    });
    marker.on('mouseout', function() {
        this.setStyle({
            fillOpacity: 0.8,
            weight: 2
        });
    });

    markers.push(marker);
    return marker;
}

function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

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

async function getAddress(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        if (!response.ok) {
            throw new Error('Failed to fetch address');
        }
        const data = await response.json();
        return data.display_name || 'Address not found';
    } catch (error) {
        console.error('Error getting address:', error);
        return 'Address not found';
    }
}

async function displayBookmarks(data) {
    const bookmarkList = document.getElementById('bookmarkList');
    bookmarkList.innerHTML = ''; // Clear existing content

    for (const [group, landmarks] of Object.entries(data.by_category)) {
        bookmarkList.innerHTML += `<h6>${group.toUpperCase()}</h6>`;
        for (const landmark of landmarks) {
            const address = await getAddress(landmark.latitude, landmark.longitude); // Fetch address
            bookmarkList.innerHTML += `
                <div class="bookmark-item mb-3" data-lat="${landmark.latitude}" data-lng="${landmark.longitude}">
                    <strong>${landmark.name}</strong><br>
                    <small>by ${landmark.added_by || 'Anonymous'}</small><br>
                    <small>Coordinates: ${landmark.latitude.toFixed(4)}, ${landmark.longitude.toFixed(4)}</small><br>
                    <small>Address: ${address}</small>
                </div>
            `;
        }
    }

    // Add click event for opening the popup on the focused marker
    document.querySelectorAll('.bookmark-item').forEach(item => {
        item.addEventListener('click', function() {
            const lat = parseFloat(this.getAttribute('data-lat'));
            const lng = parseFloat(this.getAttribute('data-lng'));
            map.setView([lat, lng], 15);
            markers.forEach(marker => {
                if (marker.getLatLng().lat === lat && marker.getLatLng().lng === lng) {
                    marker.openPopup();  // Open the popup for the focused marker
                }
            });
            scrollToMap();  // Call the scroll function
        });
    });
}

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.querySelector('.col-md-3').insertBefore(alertDiv, document.querySelector('.card'));

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
async function loadBookmarks() {
  try {
    const response = await fetch('/api/landmarks');
    if (!response.ok) {
      throw new Error('Failed to fetch landmarks');
    }

    const landmarks = await response.json();
    displayBookmarks(landmarks);
  } catch (error) {
    console.error('Error loading bookmarks:', error);
  }
}

async function displayBookmarks(landmarks) {
    const bookmarkList = document.getElementById('bookmarkList');
    bookmarkList.innerHTML = ''; // Clear existing content

    const promises = landmarks.map(async landmark => {
        if (landmark.source === 'user') {
            const address = await getAddress(landmark.latitude, landmark.longitude); // Await the address to resolve
            bookmarkList.innerHTML += `
                <div class="bookmark-item mb-3" data-lat="${landmark.latitude}" data-lng="${landmark.longitude}">
                    <strong>${landmark.name}</strong><br>
                    <small>by ${landmark.added_by || 'Anonymous'}</small><br>
                    <small>Coordinates: ${landmark.latitude.toFixed(4)}, ${landmark.longitude.toFixed(4)}</small><br>
                    <small>Address: ${address}</small>
                </div>
            `;
        }
    });

    // Wait for all promises to complete
    await Promise.all(promises);

    // Add click event to navigate to map marker
    document.querySelectorAll('.bookmark-item').forEach(item => {
        item.addEventListener('click', function() {
            const lat = parseFloat(this.getAttribute('data-lat'));
            const lng = parseFloat(this.getAttribute('data-lng'));
            map.setView([lat, lng], 15);
            markers.forEach(marker => {
                if (marker.getLatLng().lat === lat && marker.getLatLng().lng === lng) {
                    marker.openPopup();
                }
            });
            scrollToMap();
        });
    });
}

const form = document.getElementById('landmarkForm');
if (form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!selectedLocation) return;

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';

        const formData = new FormData();
        formData.append('name', document.getElementById('name').value);
        formData.append('description', document.getElementById('description').value);
        formData.append('category', document.getElementById('category').value);
        formData.append('latitude', selectedLocation.lat);
        formData.append('longitude', selectedLocation.lng);

        const photoInput = document.getElementById('photo');
        if (photoInput.files.length > 0) {
            formData.append('photo', photoInput.files[0]);
        }

        try {
            const response = await fetch('/api/landmarks', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/google_login';
                    return;
                }
                throw new Error('Failed to add landmark');
            }

            loadLandmarks(selectedLocation.lat, selectedLocation.lng);
            showAlert('success', 'Landmark added successfully!');
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



function scrollToMap() {
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.scrollIntoView({
            behavior: 'smooth'
        });
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    loadBookmarks();
});