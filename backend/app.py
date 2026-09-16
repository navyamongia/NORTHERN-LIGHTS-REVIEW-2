from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, time

app = Flask(__name__)

app.secret_key = "replace-with-a-secure-random-secret-key"

app.config["SQLALCHEMY_DATABASE_URI"] = (
    "mysql+pymysql://root:@127.0.0.1:3306/wastemanagment"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:3000",
        "http://localhost:5173"
    ]
)

db = SQLAlchemy(app)


# =========================================================
# DATABASE MODELS
# =========================================================

class Admin(db.Model):
    __tablename__ = "admins"

    admin_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)


class Restaurant(db.Model):
    __tablename__ = "restaurants"

    restaurant_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    latitude = db.Column(
        db.Numeric(10, 7),
        nullable=False
    )

    longitude = db.Column(
        db.Numeric(10, 7),
        nullable=False
    )

    closing_time = db.Column(
        db.Time,
        nullable=False
    )


class NGO(db.Model):
    __tablename__ = "ngos"

    ngo_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    latitude = db.Column(
        db.Numeric(10, 7),
        nullable=False
    )

    longitude = db.Column(
        db.Numeric(10, 7),
        nullable=False
    )


# =========================================================
# HOME
# =========================================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "success",
        "message": "SafePlate Flask API server is running."
    }), 200


# =========================================================
# REGISTER
# =========================================================

@app.route("/api/register", methods=["POST"])
def register():

    data = request.get_json() or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "").lower()

    # -----------------------------------------------------
    # VALIDATION
    # -----------------------------------------------------

    if not name:
        return jsonify({
            "error": "Name is required."
        }), 400

    if not email:
        return jsonify({
            "error": "Email is required."
        }), 400

    if not password:
        return jsonify({
            "error": "Password is required."
        }), 400

    if len(password) < 6:
        return jsonify({
            "error": "Password must be at least 6 characters."
        }), 400

    if role not in ["donor", "ngo"]:
        return jsonify({
            "error": "Invalid role. Use donor or ngo."
        }), 400

    # -----------------------------------------------------
    # CHECK EXISTING EMAIL
    # -----------------------------------------------------

    existing_restaurant = Restaurant.query.filter_by(
        email=email
    ).first()

    existing_ngo = NGO.query.filter_by(
        email=email
    ).first()

    existing_admin = Admin.query.filter_by(
        email=email
    ).first()

    if existing_restaurant or existing_ngo or existing_admin:
        return jsonify({
            "error": "An account with this email already exists."
        }), 409

    # -----------------------------------------------------
    # PASSWORD HASH
    # -----------------------------------------------------

    password_hash = generate_password_hash(password)

    try:

        # -------------------------------------------------
        # DONOR / RESTAURANT
        # -------------------------------------------------

        if role == "donor":

            restaurant = Restaurant(
                name=name,
                email=email,
                password_hash=password_hash,

                # Default values because the current
                # React signup form does not collect these.
                latitude=0.0,
                longitude=0.0,
                closing_time=time(23, 59, 59)
            )

            db.session.add(restaurant)
            db.session.commit()

            user_id = restaurant.restaurant_id

        # -------------------------------------------------
        # NGO
        # -------------------------------------------------

        elif role == "ngo":

            ngo = NGO(
                name=name,
                email=email,
                password_hash=password_hash,

                # Default location because the current
                # React signup form does not collect it.
                latitude=0.0,
                longitude=0.0
            )

            db.session.add(ngo)
            db.session.commit()

            user_id = ngo.ngo_id

        # -------------------------------------------------
        # CREATE SESSION
        # -------------------------------------------------

        session["user_id"] = user_id
        session["user_role"] = role
        session["user_name"] = name

        return jsonify({
            "status": "success",
            "message": "Account created successfully.",
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "role": role
            }
        }), 201

    except Exception as e:

        db.session.rollback()

        print("Registration error:", e)

        return jsonify({
            "error": "Unable to create account.",
            "details": str(e)
        }), 500


# =========================================================
# LOGIN
# =========================================================

@app.route("/api/login", methods=["POST"])
def login():

    data = request.get_json() or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "").lower()

    # -----------------------------------------------------
    # VALIDATION
    # -----------------------------------------------------

    if not email or not password or not role:
        return jsonify({
            "error": "Email, password, and role are required."
        }), 400

    # -----------------------------------------------------
    # FIND USER
    # -----------------------------------------------------

    user = None
    user_id = None

    if role == "donor":

        user = Restaurant.query.filter_by(
            email=email
        ).first()

        if user:
            user_id = user.restaurant_id

    elif role == "ngo":

        user = NGO.query.filter_by(
            email=email
        ).first()

        if user:
            user_id = user.ngo_id

    elif role == "admin":

        user = Admin.query.filter_by(
            email=email
        ).first()

        if user:
            user_id = user.admin_id

    else:

        return jsonify({
            "error": "Invalid role selected."
        }), 400

    # -----------------------------------------------------
    # CHECK USER
    # -----------------------------------------------------

    if not user:

        return jsonify({
            "error": "Account does not exist."
        }), 401

    # -----------------------------------------------------
    # CHECK PASSWORD
    # -----------------------------------------------------

    if not check_password_hash(
        user.password_hash,
        password
    ):

        return jsonify({
            "error": "Invalid password."
        }), 401

    # -----------------------------------------------------
    # CREATE SESSION
    # -----------------------------------------------------

    session["user_id"] = user_id
    session["user_role"] = role
    session["user_name"] = user.name

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return jsonify({
        "status": "success",
        "message": "Login successful.",
        "user": {
            "id": user_id,
            "name": user.name,
            "email": user.email,
            "role": role
        }
    }), 200


# =========================================================
# CURRENT USER
# =========================================================

@app.route("/api/current-user", methods=["GET"])
def get_current_user():

    if "user_id" not in session:

        return jsonify({
            "authenticated": False
        }), 200

    return jsonify({
        "authenticated": True,
        "user": {
            "id": session["user_id"],
            "name": session["user_name"],
            "role": session["user_role"]
        }
    }), 200


# =========================================================
# LOGOUT
# =========================================================

@app.route("/api/logout", methods=["POST"])
def logout():

    session.clear()

    return jsonify({
        "status": "logged_out",
        "message": "Logout successful."
    }), 200


# =========================================================
# DONOR PROFILE
# =========================================================

@app.route("/api/donor/profile", methods=["GET"])
def get_donor_profile():

    if "user_id" not in session:
        return jsonify({
            "error": "You must be logged in."
        }), 401

    if session.get("user_role") != "donor":
        return jsonify({
            "error": "Only donors can access this profile."
        }), 403

    restaurant = Restaurant.query.filter_by(
        restaurant_id=session["user_id"]
    ).first()

    if not restaurant:
        return jsonify({
            "error": "Donor account not found."
        }), 404

    return jsonify({
        "status": "success",
        "user": {
            "id": restaurant.restaurant_id,
            "name": restaurant.name,
            "email": restaurant.email,
            "role": "donor",
            "latitude": float(restaurant.latitude),
            "longitude": float(restaurant.longitude),
            "closing_time": (
                restaurant.closing_time.strftime("%H:%M")
                if restaurant.closing_time
                else None
            )
        }
    }), 200


class FoodItem(db.Model):
    __tablename__ = "food_items"

    food_item_id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey("restaurants.restaurant_id"), nullable=False)
    food_name = db.Column(db.String(200), nullable=False)
    servings = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(30), nullable=False, default="listed")


def serialize_food_item(item):
    return {
        "id": item.food_item_id,
        "food_name": item.food_name,
        "servings": item.servings,
        "created_at": item.created_at.isoformat() + "Z",
        "expires_at": item.expires_at.isoformat() + "Z",
        "status": item.status,
    }


@app.route("/api/donor/donations", methods=["GET"])
def get_donor_donations():
    if "user_id" not in session:
        return jsonify({"error": "You must be logged in."}), 401
    if session.get("user_role") != "donor":
        return jsonify({"error": "Only donors can access donations."}), 403

    donations = FoodItem.query.filter_by(
        restaurant_id=session["user_id"]
    ).order_by(FoodItem.created_at.desc()).all()

    now = datetime.utcnow()
    for donation in donations:
        if donation.status == "listed" and donation.expires_at <= now:
            donation.status = "expired"
    db.session.commit()

    return jsonify({"status": "success", "donations": [serialize_food_item(item) for item in donations]}), 200


@app.route("/api/donor/donations", methods=["POST"])
def create_donor_donation():
    if "user_id" not in session:
        return jsonify({"error": "You must be logged in."}), 401
    if session.get("user_role") != "donor":
        return jsonify({"error": "Only donors can create donations."}), 403

    data = request.get_json() or {}
    food_name = str(data.get("food_name", "")).strip()
    servings = data.get("servings")

    if not food_name or not isinstance(servings, int) or servings <= 0:
        return jsonify({"error": "Food name and a positive servings count are required."}), 400

    donation = FoodItem(
        restaurant_id=session["user_id"],
        food_name=food_name,
        servings=servings,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(hours=2),
        status="listed",
    )

    try:
        db.session.add(donation)
        db.session.commit()
        return jsonify({"status": "success", "donation": serialize_food_item(donation)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Unable to create donation.", "details": str(e)}), 500


# =========================================================
# CREATE TABLES
# =========================================================
@app.route("/api/donor/location", methods=["PUT"])
def update_donor_location():

    if "user_id" not in session:
        return jsonify({
            "error": "You must be logged in."
        }), 401

    if session.get("user_role") != "donor":
        return jsonify({
            "error": "Only donors can update their location."
        }), 403

    data = request.get_json() or {}

    latitude = data.get("latitude")
    longitude = data.get("longitude")

    if latitude is None or longitude is None:
        return jsonify({
            "error": "Latitude and longitude are required."
        }), 400

    try:
        latitude = float(latitude)
        longitude = float(longitude)

        if latitude < -90 or latitude > 90:
            return jsonify({
                "error": "Invalid latitude."
            }), 400

        if longitude < -180 or longitude > 180:
            return jsonify({
                "error": "Invalid longitude."
            }), 400

        restaurant = Restaurant.query.filter_by(
            restaurant_id=session["user_id"]
        ).first()

        if not restaurant:
            return jsonify({
                "error": "Donor account not found."
            }), 404

        restaurant.latitude = latitude
        restaurant.longitude = longitude

        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Location updated successfully.",
            "location": {
                "latitude": float(restaurant.latitude),
                "longitude": float(restaurant.longitude)
            }
        }), 200

    except Exception as e:

        db.session.rollback()

        print("Location update error:", e)

        return jsonify({
            "error": "Unable to update location.",
            "details": str(e)
        }), 500

@app.route("/api/donor/closing-time", methods=["PUT"])
def update_closing_time():

    if "user_id" not in session:
        return jsonify({
            "error": "You must be logged in."
        }), 401

    if session.get("user_role") != "donor":
        return jsonify({
            "error": "Only donors can update closing time."
        }), 403

    data = request.get_json() or {}

    closing_time = data.get("closing_time")

    if not closing_time:
        return jsonify({
            "error": "Closing time is required."
        }), 400

    try:

        parsed_time = time.fromisoformat(closing_time)

        restaurant = Restaurant.query.filter_by(
            restaurant_id=session["user_id"]
        ).first()

        if not restaurant:
            return jsonify({
                "error": "Donor account not found."
            }), 404

        restaurant.closing_time = parsed_time

        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Closing time updated successfully.",
            "closing_time": restaurant.closing_time.strftime("%H:%M:%S")
        }), 200

    except ValueError:

        return jsonify({
            "error": "Invalid time format. Use HH:MM:SS."
        }), 400

    except Exception as e:

        db.session.rollback()

        print("Closing time update error:", e)

        return jsonify({
            "error": "Unable to update closing time.",
            "details": str(e)
        }), 500

with app.app_context():
    db.create_all()


# =========================================================
# RUN SERVER
# =========================================================

if __name__ == "__main__":
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )
