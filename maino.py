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

if __name__ == "__main__":
    # Ensure upload directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(host="0.0.0.0", port=5000)
