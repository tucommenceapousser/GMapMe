from flask import render_template, jsonify, request
from flask_login import current_user, login_required
from app import app, db
from models import Landmark
import requests
from utils import get_wikipedia_landmarks

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
            'source': 'user',
            'added_by': l.author.username if l.author else 'Anonymous'
        })
    
    return jsonify(landmarks)

@app.route('/api/landmarks', methods=['POST'])
@login_required
def add_landmark():
    data = request.json
    landmark = Landmark(
        name=data['name'],
        latitude=data['latitude'],
        longitude=data['longitude'],
        description=data['description'],
        category=data['category'],
        source='user',
        user_id=current_user.id
    )
    db.session.add(landmark)
    db.session.commit()
    return jsonify({'status': 'success'})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
