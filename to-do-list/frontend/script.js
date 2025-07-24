// frontend/script.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/tasks';
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');

    // Fetch and render all tasks from the server
    async function fetchTasks() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Unable to fetch tasks.');
            const tasks = await response.json();
            taskList.innerHTML = '';
            tasks.forEach(renderTask);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            alert('Failed to load tasks. Please try again later.');
        }
    }

    // Render a single task row
    function renderTask(task) {
        const tr = document.createElement('tr');
        tr.className = 'task-item';
        tr.dataset.id = task._id;
        if (task.completed) tr.classList.add('completed');

        const textTd = document.createElement('td');
        const textSpan = document.createElement('span');
        textSpan.className = 'text';
        textSpan.textContent = task.text;
        textTd.appendChild(textSpan);

        const actionsTd = document.createElement('td');
        actionsTd.className = 'actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '❌';
        deleteBtn.className = 'delete-btn';
        actionsTd.appendChild(deleteBtn);

        tr.appendChild(textTd);
        tr.appendChild(actionsTd);
        taskList.appendChild(tr);
    }

    // Add a new task to the server and UI
    async function addTask() {
        const taskText = taskInput.value.trim();
        if (!taskText) {
            alert('Task cannot be empty.');
            return;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: taskText })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Unable to add task.');
            }

            const newTask = await response.json();
            renderTask(newTask);
            taskInput.value = '';
        } catch (error) {
            console.error('Error adding task:', error);
            alert(error.message);
        }
    }

    // Handle task completion and deletion
    async function handleTaskClick(event) {
        const target = event.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;

        const taskId = taskItem.dataset.id;

        if (target.classList.contains('delete-btn')) {
            try {
                const response = await fetch(`${API_URL}/${taskId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Unable to delete task.');
                taskItem.remove();
            } catch (error) {
                console.error('Error deleting task:', error);
                alert('Failed to delete task.');
            }
        } else if (target.classList.contains('text')) {
            try {
                const response = await fetch(`${API_URL}/${taskId}`, { method: 'PUT' });
                if (!response.ok) throw new Error('Unable to update task.');
                taskItem.classList.toggle('completed');
            } catch (error) {
                console.error('Error updating task:', error);
                alert('Failed to update task.');
            }
        }
    }

    // Event listeners
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    taskList.addEventListener('click', handleTaskClick);

    // Initial load
    fetchTasks();
});