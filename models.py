from app import db
from datetime import datetime
from flask_login import UserMixin

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    landmarks = db.relationship('Landmark', backref='author', lazy=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Landmark(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(50), default='historical')
    photo = db.Column(db.String(200))  # Store the photo filename
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    source = db.Column(db.String(50), default='user')
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
