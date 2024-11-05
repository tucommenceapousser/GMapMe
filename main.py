import os
from datetime import datetime
from flask import render_template, jsonify, request, current_app
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
from app import app, db
from models import Landmark
import requests
from utils import get_wikipedia_landmarks

# Configure upload settings
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/landmarks')
def get_landmarks():
    lat = float(request.args.get('lat', 0))
    lng = float(request.args.get('lng', 0))
    
    # Get Wikipedia landmarks
    wiki_landmarks = get_wikipedia_landmarks(lat, lng)
    
    # Get user-added landmarks from database
    user_landmarks = Landmark.query.filter_by(source='user').all()
    
    landmarks = []
    # Format Wikipedia landmarks
    for l in wiki_landmarks:
        landmarks.append({
            'name': l['title'],
            'latitude': l['lat'],
            'longitude': l['lng'],
            'description': l['description'],
            'source': 'wikipedia'
        })
    
    # Format user landmarks
    for l in user_landmarks:
        landmarks.append({
            'name': l.name,
            'latitude': l.latitude,
            'longitude': l.longitude,
            'description': l.description,
            'category': l.category,
            'photo': l.photo,
            'source': 'user',
            'added_by': l.author.username if l.author else 'Anonymous'
        })
    
    return jsonify(landmarks)

@app.route('/api/landmarks', methods=['POST'])
@login_required
def add_landmark():
    try:
        name = request.form.get('name')
        latitude = float(request.form.get('latitude'))
        longitude = float(request.form.get('longitude'))
        description = request.form.get('description')
        category = request.form.get('category')
        
        # Create landmark instance
        landmark = Landmark(
            name=name,
            latitude=latitude,
            longitude=longitude,
            description=description,
            category=category,
            source='user',
            user_id=current_user.id
        )

        # Handle photo upload
        if 'photo' in request.files:
            photo = request.files['photo']
            if photo and allowed_file(photo.filename):
                filename = secure_filename(f"{current_user.id}_{int(datetime.utcnow().timestamp())}_{photo.filename}")
                photo.save(os.path.join(UPLOAD_FOLDER, filename))
                landmark.photo = filename

        db.session.add(landmark)
        db.session.commit()
        return jsonify({'status': 'success'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/bookmarks')
@login_required
def get_bookmarks():
    # Fetch bookmarks from the database
    user_landmarks = Landmark.query.all()

    # Debug statement to check what landmarks are retrieved
    print(user_landmarks)

    # Group bookmarks
    bookmarks_by_category = {}
    bookmarks_by_user = {}
    bookmarks_by_location = {}

    for landmark in user_landmarks:
        category = landmark.category
        user = landmark.author.username if landmark.author else 'Anonymous'
        location = (landmark.latitude, landmark.longitude)

        # Group by category
        if category not in bookmarks_by_category:
            bookmarks_by_category[category] = []
        bookmarks_by_category[category].append({
            'name': landmark.name,
            'latitude': landmark.latitude,
            'longitude': landmark.longitude,
            'added_by': user
        })

    # Debug statement to inspect the collected bookmarks
    print({
        'by_category': bookmarks_by_category,
        'by_user': bookmarks_by_user,
        'by_location': bookmarks_by_location
    })

    return jsonify({
        'by_category': bookmarks_by_category,
        'by_user': bookmarks_by_user,
        'by_location': bookmarks_by_location
    })

if __name__ == "__main__":
    # Ensure upload directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(host="0.0.0.0", port=5000)
