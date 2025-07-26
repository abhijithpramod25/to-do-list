from flask import Flask, request, jsonify, send_from_directory
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import json
import os
import uuid

# --- Configuration ---
backend_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(backend_dir, '..', 'frontend')
TASKS_FILE = os.path.join(backend_dir, 'tasks.json')
USERS_FILE = os.path.join(backend_dir, 'users.json')

# --- App Initialization ---
app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
app.config['SECRET_KEY'] = 'a_very_secret_key_that_should_be_changed'
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login.html'

# --- Data Helper Functions ---
def read_data(file_path):
    if not os.path.exists(file_path): return []
    try:
        with open(file_path, 'r') as f: return json.load(f)
    except (IOError, json.JSONDecodeError): return []

def write_data(file_path, data):
    with open(file_path, 'w') as f: json.dump(data, f, indent=4)

# --- User Model ---
class User(UserMixin):
    def __init__(self, id, username, password):
        self.id = id
        self.username = username
        self.password = password
    @staticmethod
    def get(user_id):
        users = read_data(USERS_FILE)
        for user_data in users:
            if user_data.get('id') == user_id:
                return User(id=user_data['id'], username=user_data['username'], password=user_data['password'])
        return None

@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)

# --- Authentication API Routes ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password: return jsonify({"error": "Username and password are required"}), 400
    users = read_data(USERS_FILE)
    if any(u['username'] == username for u in users): return jsonify({"error": "Username already exists"}), 409
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = {"id": str(uuid.uuid4()), "username": username, "password": hashed_password}
    users.append(new_user)
    write_data(USERS_FILE, users)
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    users = read_data(USERS_FILE)
    user_data = next((u for u in users if u['username'] == username), None)
    if user_data and bcrypt.check_password_hash(user_data['password'], password):
        user = User(id=user_data['id'], username=user_data['username'], password=user_data['password'])
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

# --- Task API Routes ---
@app.route('/api/tasks', methods=['GET', 'POST'])
@login_required
def handle_tasks():
    user_id = current_user.id
    all_tasks = read_data(TASKS_FILE)
    if request.method == 'POST':
        task_data = request.get_json()
        if not task_data or not task_data.get('text', '').strip(): return jsonify({'error': 'Task text cannot be empty'}), 400
        new_task = {
            '_id': str(uuid.uuid4()), 'text': task_data['text'].strip(), 'completed': False, 'user_id': user_id,
            'priority': task_data.get('priority', 'medium'), 'subtasks': [],
            'dueDate': task_data.get('dueDate')
        }
        all_tasks.append(new_task)
        write_data(TASKS_FILE, all_tasks)
        return jsonify(new_task), 201
    else:
        user_tasks = [task for task in all_tasks if task.get('user_id') == user_id]
        return jsonify(user_tasks)

@app.route('/api/tasks/<task_id>', methods=['PUT', 'DELETE'])
@login_required
def handle_single_task(task_id):
    user_id = current_user.id
    all_tasks = read_data(TASKS_FILE)
    task = next((t for t in all_tasks if t.get('_id') == task_id and t.get('user_id') == user_id), None)
    if not task: return jsonify({'error': 'Task not found or not authorized'}), 404
    if request.method == 'PUT':
        task['completed'] = not task.get('completed', False)
        write_data(TASKS_FILE, all_tasks)
        return jsonify(task), 200
    elif request.method == 'DELETE':
        tasks_after_deletion = [t for t in all_tasks if t.get('_id') != task_id]
        write_data(TASKS_FILE, tasks_after_deletion)
        return '', 204

# --- Subtask Routes ---
@app.route('/api/tasks/<task_id>/subtasks', methods=['POST'])
@login_required
def add_subtask(task_id):
    data = request.get_json()
    if not data or not data.get('text', '').strip(): return jsonify({'error': 'Subtask text cannot be empty'}), 400
    all_tasks = read_data(TASKS_FILE)
    task = next((t for t in all_tasks if t.get('_id') == task_id and t.get('user_id') == current_user.id), None)
    if not task: return jsonify({'error': 'Parent task not found'}), 404
    new_subtask = {'_id': str(uuid.uuid4()), 'text': data['text'].strip(), 'completed': False}
    task.setdefault('subtasks', []).append(new_subtask)
    write_data(TASKS_FILE, all_tasks)
    return jsonify(new_subtask), 201

@app.route('/api/tasks/<task_id>/subtasks/<subtask_id>', methods=['PUT', 'DELETE'])
@login_required
def handle_single_subtask(task_id, subtask_id):
    all_tasks = read_data(TASKS_FILE)
    task = next((t for t in all_tasks if t.get('_id') == task_id and t.get('user_id') == current_user.id), None)
    if not task: return jsonify({'error': 'Parent task not found'}), 404
    subtask = next((st for st in task.get('subtasks', []) if st.get('_id') == subtask_id), None)
    if not subtask: return jsonify({'error': 'Subtask not found'}), 404
    if request.method == 'PUT':
        subtask['completed'] = not subtask.get('completed', False)
    elif request.method == 'DELETE':
        task['subtasks'] = [st for st in task.get('subtasks', []) if st.get('_id') != subtask_id]
    write_data(TASKS_FILE, all_tasks)
    return jsonify(task if request.method == 'PUT' else ''), 200 if request.method == 'PUT' else 204

# --- Serve Frontend ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if not current_user.is_authenticated and path not in ['login.html', 'register.html', 'style.css', 'auth.js']:
        return send_from_directory(app.static_folder, 'login.html')
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    if not os.path.exists(USERS_FILE): write_data(USERS_FILE, [])
    if not os.path.exists(TASKS_FILE): write_data(TASKS_FILE, [])
    app.run(host='0.0.0.0', port=5000, debug=True)