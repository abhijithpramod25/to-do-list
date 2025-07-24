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

# --- Helper Functions for Local DB ---

def read_tasks():
    """Reads the list of tasks from the JSON file."""
    if not os.path.exists(TASKS_FILE):
        return []
    try:
        with open(TASKS_FILE, 'r') as f:
            return json.load(f)
    except (IOError, json.JSONDecodeError):
        return []

def write_tasks(tasks):
    """Writes the list of tasks to the JSON file."""
    try:
        with open(TASKS_FILE, 'w') as f:
            json.dump(tasks, f, indent=4)
    except IOError as e:
        print(f"Error writing to tasks file: {e}")

# --- API Blueprint ---
api = Blueprint('api', __name__, url_prefix='/api')

@api.route('/tasks', methods=['GET', 'POST'])
def handle_tasks():
    if request.method == 'POST':
        task_data = request.get_json()
        if not task_data or 'text' not in task_data or not task_data['text'].strip():
            return jsonify({'error': 'Task text cannot be empty'}), 400

        tasks = read_tasks()
        new_task = {
            '_id': str(uuid.uuid4()),  # Generate a unique ID
            'text': task_data['text'].strip(),
            'completed': False
        }
        tasks.append(new_task)
        write_tasks(tasks)
        return jsonify(new_task), 201
    else: # GET
        tasks = read_tasks()
        return jsonify(tasks)

@api.route('/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    tasks = read_tasks()
    task_found = None
    for task in tasks:
        if task['_id'] == task_id:
            task['completed'] = not task.get('completed', False)
            task_found = task
            break
    
    if task_found:
        write_tasks(tasks)
        return jsonify({'message': 'Task updated successfully'}), 200
    
    return jsonify({'error': 'Task not found'}), 404

@api.route('/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    tasks = read_tasks()
    original_length = len(tasks)
    # Filter out the task to be deleted
    tasks = [task for task in tasks if task['_id'] != task_id]
    
    if len(tasks) < original_length:
        write_tasks(tasks)
        return jsonify({'message': 'Task deleted successfully'}), 200
    
    return jsonify({'error': 'Task not found'}), 404

app.register_blueprint(api)

# --- Route to serve the main application ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    file_path = os.path.join(app.static_folder, path)
    if path != "" and os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # Create the tasks file if it doesn't exist
    if not os.path.exists(TASKS_FILE):
        write_tasks([])
    app.run(host='0.0.0.0', port=5000, debug=True)
