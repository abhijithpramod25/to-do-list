import os
import re
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from pymongo import MongoClient
from bson import ObjectId

load_dotenv()

# --- App Initialization & Config ---
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend'))
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "a_default_secret_key")
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login.html'

# --- MongoDB Connection ---
MONGO_URI = os.getenv("MONGO_URI")
db = None
if MONGO_URI:
    try:
        client = MongoClient(MONGO_URI)
        client.admin.command('ismaster')
        db = client.get_database()
        print("✅ MongoDB connection successful.")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
else:
    print("❌ MONGO_URI environment variable not set.")

# --- User Model & Loader ---
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
def load_user(user_id): return User.get(user_id)

def serialize_doc(doc):
    if doc:
        doc['_id'] = str(doc['_id'])
        if 'user_id' in doc: doc['user_id'] = str(doc['user_id'])
        if 'subtasks' in doc:
            for subtask in doc['subtasks']:
                if '_id' in subtask: subtask['_id'] = str(subtask['_id'])
    return doc

# --- Auth Routes --- (Unchanged)
@app.route('/api/register', methods=['POST'])
def register():
    if db is None: return jsonify({"error": "Database connection is not available"}), 500
    data = request.get_json()
    username, password = data.get('username'), data.get('password')
    if not username or not password: return jsonify({"error": "Username and password are required"}), 400
    if db.users.find_one({'username': username}): return jsonify({"error": "Username already exists"}), 409
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    db.users.insert_one({'username': username, 'password': hashed_password})
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    if db is None: return jsonify({"error": "Database connection is not available"}), 500
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
def logout(): logout_user(); return jsonify({"message": "Logout successful"}), 200

@app.route('/api/status')
def status():
    if current_user.is_authenticated:
        return jsonify({"logged_in": True, "user": {"id": current_user.id, "username": current_user.username}}), 200
    return jsonify({"logged_in": False}), 401

# --- Task Routes ---
@app.route('/api/tasks', methods=['GET', 'POST'])
@login_required
def handle_tasks():
    if db is None: return jsonify({"error": "Database connection is not available"}), 500
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
        # --- MODIFICATION START: MongoDB Filtering, Searching, and Sorting ---
        query = {'user_id': user_id}
        
        search_term = request.args.get('search', '')
        if search_term:
            query['text'] = {'$regex': re.escape(search_term), '$options': 'i'}

        task_filter = request.args.get('filter', 'all')
        if task_filter == 'active':
            query['completed'] = False
        elif task_filter == 'completed':
            query['completed'] = True

        sort_by = request.args.get('sortBy', 'default')
        sort_query = []
        if sort_by == 'dueDate':
            sort_query = [('dueDate', 1)]
        elif sort_by == 'priority':
            pipeline = [
                {'$match': query},
                {'$addFields': {
                    'priorityOrder': {
                        '$switch': {
                            'branches': [
                                {'case': {'$eq': ['$priority', 'high']}, 'then': 1},
                                {'case': {'$eq': ['$priority', 'medium']}, 'then': 2},
                                {'case': {'$eq': ['$priority', 'low']}, 'then': 3}
                            ], 'default': 4
                        }
                    }
                }},
                {'$sort': {'priorityOrder': 1}}
            ]
            user_tasks = [serialize_doc(task) for task in db.tasks.aggregate(pipeline)]
            return jsonify(user_tasks)

        cursor = db.tasks.find(query)
        if sort_query:
            cursor = cursor.sort(sort_query)
        
        user_tasks = [serialize_doc(task) for task in cursor]
        return jsonify(user_tasks)
        # --- MODIFICATION END ---

@app.route('/api/tasks/<task_id>', methods=['PUT', 'DELETE'])
@login_required
def handle_single_task(task_id):
    # ... (unchanged)
    if db is None: return jsonify({"error": "Database connection is not available"}), 500
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

# --- Subtask Routes --- (Unchanged)
@app.route('/api/tasks/<task_id>/subtasks', methods=['POST'])
@login_required
def add_subtask(task_id):
    if db is None: return jsonify({"error": "Database connection is not available"}), 500
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
    if db is None: return jsonify({"error": "Database connection is not available"}), 500
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

# --- Serve Frontend --- (Unchanged)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder = app.static_folder
    if not current_user.is_authenticated and path not in ['login.html', 'register.html', 'style.css', 'auth.js']:
        return send_from_directory(static_folder, 'login.html')
    if path and os.path.exists(os.path.join(static_folder, path)):
        return send_from_directory(static_folder, path)
    return send_from_directory(static_folder, 'index.html')

if __name__ == '__main__':
    if db is None:
        print("\n--- 🚨 Cannot start server: MongoDB connection failed. 🚨 ---\n")
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)