import os
import logging
from datetime import datetime
from flask import render_template, jsonify, request, current_app
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
from app import app, db
from models import Landmark
import requests
from utils import get_wikipedia_landmarks

# Configure logging
logging.basicConfig(level=logging.INFO)
log_file_handler = logging.FileHandler('log.txt')
bookmark_file_handler = logging.FileHandler('bookmark.txt')

log_file_handler.setLevel(logging.INFO)
bookmark_file_handler.setLevel(logging.INFO)

log_formatter = logging.Formatter('%(asctime)s - %(message)s')
log_file_handler.setFormatter(log_formatter)
bookmark_file_handler.setFormatter(log_formatter)

logger = logging.getLogger(__name__)
logger.addHandler(log_file_handler)

bookmark_logger = logging.getLogger('bookmark_logger')
bookmark_logger.addHandler(bookmark_file_handler)

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

# Additional logging for user login can be added
def get_client_ip():
    if request.headers.getlist("X-Forwarded-For"):
        ip = request.headers.getlist("X-Forwarded-For")[0]
    else:
        ip = request.remote_addr
    return ip

# Use this function to get the IP when logging

@app.before_request
def before_request():
    if current_user.is_authenticated:
        client_ip = get_client_ip()
        logger.info(f'User logged in: UserID={current_user.id}, IP={client_ip}')

@app.route('/api/landmarks', methods=['POST'])
@login_required
def add_landmark():
    try:
        name = request.form.get('name')
        latitude = float(request.form.get('latitude'))
        longitude = float(request.form.get('longitude'))
        description = request.form.get('description')
        category = request.form.get('category')

        landmark = Landmark(
            name=name,
            latitude=latitude,
            longitude=longitude,
            description=description,
            category=category,
            source='user',
            user_id=current_user.id
        )

        if 'photo' in request.files:
            photo = request.files['photo']
            if photo and allowed_file(photo.filename):
                filename = secure_filename(f"{current_user.id}_{int(datetime.utcnow().timestamp())}_{photo.filename}")
                photo.save(os.path.join(UPLOAD_FOLDER, filename))
                landmark.photo = filename

        db.session.add(landmark)
        db.session.commit()

        # Log the bookmark creation
        client_ip = get_client_ip()
        bookmark_logger.info(f'Bookmark created: Name={name}, Latitude={latitude}, Longitude={longitude}, IP={client_ip}')

        return jsonify({'status': 'success'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/manage')
@login_required  # ensure only logged in users can access
def manage():
    return render_template('manage.html')

@app.route('/3d')
@login_required  # ensure only logged in users can access
def troid():
    return render_template('3d.html')

@app.route('/api/manage/bookmarks')
@login_required
def api_get_bookmarks():
    # Fetch all bookmarks from the database
    user_landmarks = Landmark.query.all()  # or filter by certain criteria
    return jsonify([{
        'id': l.id,
        'name': l.name,
    } for l in user_landmarks])

@app.route('/api/manage/bookmarks/<int:bookmark_id>', methods=['DELETE'])
@login_required
def api_delete_bookmark(bookmark_id):
    try:
        landmark = Landmark.query.get(bookmark_id)
        if not landmark:
            return jsonify({'status': 'error', 'message': 'Bookmark not found'}), 404

        db.session.delete(landmark)
        db.session.commit()
        return jsonify({'status': 'success'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/manage/logs')
@login_required
def api_get_logs():
    try:
        with open('log.txt', 'r') as file:
            log_data = file.read()
        return log_data, 200
    except FileNotFoundError:
        return "Log file not found", 404

@app.route('/api/manage/bookmarklogs')
@login_required
def api_get_bookmark_logs():
    try:
        with open('bookmark.txt', 'r') as file:
            log_data = file.read()
        return log_data, 200
    except FileNotFoundError:
        return "Bookmark log file not found", 404

if __name__ == "__main__":
    # Ensure upload directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(host="0.0.0.0", port=5000)

