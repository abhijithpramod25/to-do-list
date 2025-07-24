from flask import Flask, request, jsonify, send_from_directory, Blueprint, render_template
from pymongo import MongoClient
from bson import ObjectId
from flask_cors import CORS
import json
import os

# --- Create Flask App and configure paths ---
# Determine the absolute path to the frontend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(backend_dir, '..', 'frontend')

# Serve static files from the 'frontend' directory, and set the template folder
app = Flask(__name__, 
            static_folder=frontend_dir, 
            template_folder=frontend_dir,
            static_url_path='') # Serve static files from the root
CORS(app)

# --- Custom JSON Encoder to handle MongoDB's ObjectId ---
class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return super().default(o)

app.json_encoder = JSONEncoder

# --- MongoDB Connection ---
MONGO_URI = "mongodb+srv://abhijithpramod25:IeM36IuFHeV5sWKV@cluster0.ky61m3p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = MongoClient(MONGO_URI)
db = client['todolist_db']
tasks_collection = db['tasks']

# --- API Blueprint ---
# Create a Blueprint object. All routes defined with this object will be prefixed with /api
api = Blueprint('api', __name__, url_prefix='/api')

@api.route('/tasks', methods=['GET', 'POST'])
def handle_tasks():
    """Handles both fetching and adding tasks to the database."""
    if request.method == 'POST':
        # Logic to ADD a new task
        task_data = request.get_json()
        if not task_data or 'text' not in task_data or not task_data['text'].strip():
            return jsonify({'error': 'Task text cannot be empty'}), 400
        
        result = tasks_collection.insert_one({
            'text': task_data['text'].strip(),
            'completed': False
        })
        new_task = tasks_collection.find_one({'_id': result.inserted_id})
        return jsonify(new_task), 201
    else:
        # Logic to GET all tasks
        tasks = list(tasks_collection.find({}))
        return jsonify(tasks)

@api.route('/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    """Toggles the completed status of a task."""
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        return jsonify({'error': 'Invalid task ID format'}), 400

    task = tasks_collection.find_one({'_id': obj_id})
    if task:
        new_status = not task.get('completed', False)
        tasks_collection.update_one({'_id': obj_id}, {'$set': {'completed': new_status}})
        return jsonify({'message': 'Task updated successfully'}), 200
    return jsonify({'error': 'Task not found'}), 404

@api.route('/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Deletes a task from the database."""
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        return jsonify({'error': 'Invalid task ID format'}), 400
        
    result = tasks_collection.delete_one({'_id': obj_id})
    if result.deleted_count == 1:
        return jsonify({'message': 'Task deleted successfully'}), 200
    return jsonify({'error': 'Task not found'}), 404

# Register the blueprint with the main Flask app
app.register_blueprint(api)

# --- Route to serve the main application ---
# This will catch all non-API routes and serve the main HTML page.
# The frontend router will then handle the specific URL.
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')


# --- Start Server ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
