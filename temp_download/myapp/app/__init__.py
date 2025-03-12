from flask import Flask
from flask_cors import CORS
from flask_mail import Mail
from config import Config
from .models import db

mail = Mail()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    CORS(app)
    db.init_app(app)
    mail.init_app(app)
    
    with app.app_context():
        db.create_all()
    
    from .views import main
    app.register_blueprint(main)
    
    return app 