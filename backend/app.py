from flask import Flask, request, jsonify, send_from_directory, Blueprint
import json
import os
import uuid

# --- Configuration ---
backend_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(backend_dir, '..', 'frontend')
TASKS_FILE = os.path.join(backend_dir, 'tasks.json')

# --- Create Flask App ---
app = Flask(
    __name__,
    static_folder=frontend_dir,
    template_folder=frontend_dir,
    static_url_path=''
)

# --- Helper Functions ---
def read_tasks():
    if not os.path.exists(TASKS_FILE): return []
    try:
        with open(TASKS_FILE, 'r') as f: return json.load(f)
    except (IOError, json.JSONDecodeError): return []

def write_tasks(tasks):
    with open(TASKS_FILE, 'w') as f: json.dump(tasks, f, indent=4)

# --- API ---
api = Blueprint('api', __name__, url_prefix='/api')

@api.route('/tasks', methods=['GET', 'POST'])
def handle_tasks():
    if request.method == 'POST':
        task_data = request.get_json()
        if not task_data or not task_data.get('text', '').strip():
            return jsonify({'error': 'Task text cannot be empty'}), 400

        tasks = read_tasks()
        new_task = {
            '_id': str(uuid.uuid4()),
            'text': task_data['text'].strip(),
            'completed': False,
            'subtasks': [],
            # --- MODIFICATION ---
            'priority': task_data.get('priority', 'medium')
            # --- MODIFICATION END ---
        }
        
        if 'dueDate' in task_data and task_data['dueDate']:
            new_task['dueDate'] = task_data['dueDate']

        tasks.append(new_task)
        write_tasks(tasks)
        return jsonify(new_task), 201
    else:  # GET
        tasks = read_tasks()
        return jsonify(tasks)

@api.route('/tasks/<task_id>', methods=['PUT', 'DELETE'])
def handle_single_task(task_id):
    # This function remains unchanged
    tasks = read_tasks()
    task = next((t for t in tasks if t.get('_id') == task_id), None)
    if not task: return jsonify({'error': 'Task not found'}), 404
    if request.method == 'PUT':
        task['completed'] = not task.get('completed', False)
        write_tasks(tasks)
        return jsonify(task)
    elif request.method == 'DELETE':
        tasks = [t for t in tasks if t.get('_id') != task_id]
        write_tasks(tasks)
        return '', 204

# --- Subtask Routes ---
@api.route('/tasks/<task_id>/subtasks', methods=['POST'])
def add_subtask(task_id):
    # This function remains unchanged
    data = request.get_json()
    if not data or not data.get('text', '').strip(): return jsonify({'error': 'Subtask text cannot be empty'}), 400
    tasks = read_tasks()
    task = next((t for t in tasks if t.get('_id') == task_id), None)
    if not task: return jsonify({'error': 'Parent task not found'}), 404
    new_subtask = {'_id': str(uuid.uuid4()), 'text': data['text'].strip(), 'completed': False}
    task.setdefault('subtasks', []).append(new_subtask)
    write_tasks(tasks)
    return jsonify(new_subtask), 201

@api.route('/tasks/<task_id>/subtasks/<subtask_id>', methods=['PUT', 'DELETE'])
def handle_single_subtask(task_id, subtask_id):
    # This function remains unchanged
    tasks = read_tasks()
    task = next((t for t in tasks if t.get('_id') == task_id), None)
    if not task: return jsonify({'error': 'Parent task not found'}), 404
    subtask = next((st for st in task.get('subtasks', []) if st.get('_id') == subtask_id), None)
    if not subtask: return jsonify({'error': 'Subtask not found'}), 404
    if request.method == 'PUT':
        subtask['completed'] = not subtask.get('completed', False)
        write_tasks(tasks)
        return jsonify(subtask)
    elif request.method == 'DELETE':
        task['subtasks'] = [st for st in task.get('subtasks', []) if st.get('_id') != subtask_id]
        write_tasks(tasks)
        return '', 204

app.register_blueprint(api)

# --- Serve Frontend ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    if not os.path.exists(TASKS_FILE): write_tasks([])
    app.run(host='0.0.0.0', port=5000, debug=True)