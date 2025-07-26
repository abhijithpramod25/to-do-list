from flask import Flask, request, jsonify, send_from_directory
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from pymongo import MongoClient
from bson import ObjectId
import os

# --- Configuration ---
backend_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(backend_dir, '..', 'frontend')

# --- App Initialization ---
app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
app.config['SECRET_KEY'] = 'a_very_secret_key_that_should_be_changed'
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login.html'

# --- MONGODB CONNECTION ---
# Replace this with your actual MongoDB Atlas connection string.
# Ensure it includes your database name (e.g., /todo_app_db).
MONGO_URI = "mongodb+srv://abhijithpramod25:IeM36IuFHeV5sWKV@cluster0.ky61m3p.mongodb.net/todo_app_db?retryWrites=true&w=majority"
try:
    client = MongoClient(MONGO_URI)
    db = client.get_database('todo_app_db')
    # Test the connection
    client.server_info()
    print("MongoDB connection successful.")
except Exception as e:
    print(f"MongoDB connection failed: {e}")
    db = None

# --- User Model ---
class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data['_id'])
        self.username = user_data['username']
        self.password = user_data['password']

    @staticmethod
    def get(user_id):
        if db is None: return None
        user_data = db.users.find_one({'_id': ObjectId(user_id)})
        return User(user_data) if user_data else None

@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)

def serialize_doc(doc):
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    if doc and 'user_id' in doc:
        doc['user_id'] = str(doc['user_id'])
    # Serialize ObjectId in subtasks if they exist
    if doc and 'subtasks' in doc:
        for subtask in doc['subtasks']:
            if '_id' in subtask:
                subtask['_id'] = str(subtask['_id'])
    return doc

# --- AUTHENTICATION API ROUTES ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username, password = data.get('username'), data.get('password')
    if not username or not password: return jsonify({"error": "Username and password are required"}), 400
    if db.users.find_one({'username': username}): return jsonify({"error": "Username already exists"}), 409
    
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    db.users.insert_one({'username': username, 'password': hashed_password})
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username, password = data.get('username'), data.get('password')
    user_data = db.users.find_one({'username': username})
    
    if user_data and bcrypt.check_password_hash(user_data['password'], password):
        user = User(user_data)
        login_user(user)
        return jsonify({"message": "Login successful", "user": {"id": user.id, "username": user.username}}), 200
    
    return jsonify({"error": "Invalid username or password"}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logout successful"}), 200

@app.route('/api/status')
def status():
    if current_user.is_authenticated:
        return jsonify({"logged_in": True, "user": {"id": current_user.id, "username": current_user.username}}), 200
    return jsonify({"logged_in": False}), 401

# --- TASK API ROUTES ---
@app.route('/api/tasks', methods=['GET', 'POST'])
@login_required
def handle_tasks():
    user_id = ObjectId(current_user.id)
    if request.method == 'POST':
        task_data = request.get_json()
        if not task_data or not task_data.get('text', '').strip(): return jsonify({'error': 'Task text cannot be empty'}), 400
        
        new_task = {
            'text': task_data['text'].strip(), 'completed': False, 'user_id': user_id,
            'priority': task_data.get('priority', 'medium'), 'subtasks': [], 'dueDate': task_data.get('dueDate')
        }
        result = db.tasks.insert_one(new_task)
        inserted_task = db.tasks.find_one({'_id': result.inserted_id})
        return jsonify(serialize_doc(inserted_task)), 201
    else: # GET
        user_tasks = [serialize_doc(task) for task in db.tasks.find({'user_id': user_id})]
        return jsonify(user_tasks)

@app.route('/api/tasks/<task_id>', methods=['PUT', 'DELETE'])
@login_required
def handle_single_task(task_id):
    user_id, task_oid = ObjectId(current_user.id), ObjectId(task_id)
    task = db.tasks.find_one({'_id': task_oid, 'user_id': user_id})
    if not task: return jsonify({'error': 'Task not found or not authorized'}), 404

    if request.method == 'PUT':
        new_status = not task.get('completed', False)
        db.tasks.update_one({'_id': task_oid}, {'$set': {'completed': new_status}})
        updated_task = db.tasks.find_one({'_id': task_oid})
        return jsonify(serialize_doc(updated_task)), 200
    elif request.method == 'DELETE':
        db.tasks.delete_one({'_id': task_oid})
        return '', 204

# --- SUBTASK ROUTES ---
@app.route('/api/tasks/<task_id>/subtasks', methods=['POST'])
@login_required
def add_subtask(task_id):
    data = request.get_json()
    if not data or not data.get('text', '').strip(): return jsonify({'error': 'Subtask text cannot be empty'}), 400

    new_subtask = {'_id': ObjectId(), 'text': data['text'].strip(), 'completed': False}
    result = db.tasks.update_one(
        {'_id': ObjectId(task_id), 'user_id': ObjectId(current_user.id)},
        {'$push': {'subtasks': new_subtask}}
    )
    if result.matched_count == 0: return jsonify({'error': 'Parent task not found'}), 404
    return jsonify(serialize_doc(new_subtask)), 201

@app.route('/api/tasks/<task_id>/subtasks/<subtask_id>', methods=['PUT', 'DELETE'])
@login_required
def handle_single_subtask(task_id, subtask_id):
    user_id, task_oid, subtask_oid = ObjectId(current_user.id), ObjectId(task_id), ObjectId(subtask_id)

    if request.method == 'PUT':
        task = db.tasks.find_one({'_id': task_oid, 'subtasks._id': subtask_oid, 'user_id': user_id})
        if not task: return jsonify({'error': 'Subtask not found'}), 404
        
        new_status = not next(st['completed'] for st in task['subtasks'] if st['_id'] == subtask_oid)
        db.tasks.update_one(
            {'_id': task_oid, 'subtasks._id': subtask_oid},
            {'$set': {'subtasks.$.completed': new_status}}
        )
        return jsonify({"message": "Subtask updated"}), 200

    elif request.method == 'DELETE':
        db.tasks.update_one(
            {'_id': task_oid, 'user_id': user_id},
            {'$pull': {'subtasks': {'_id': subtask_oid}}}
        )
        return '', 204

# --- Serve Frontend ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # This logic correctly serves login/register pages or redirects to them.
    if not current_user.is_authenticated and path not in ['login.html', 'register.html', 'style.css', 'auth.js']:
        return send_from_directory(app.static_folder, 'login.html')
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    if db is None:
        print("\n--- Cannot start server: MongoDB connection is not configured or failed. ---")
        print("--- Please check your MONGO_URI in app.py and network access rules in MongoDB Atlas. ---\n")
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)