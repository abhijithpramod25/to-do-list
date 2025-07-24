// frontend/script.js

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/tasks';
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');

    // Fetch all tasks from the server and render them
    async function fetchTasks() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error('Failed to fetch tasks');
            }
            const tasks = await response.json();
            taskList.innerHTML = ''; // Clear existing tasks
            tasks.forEach(task => renderTask(task));
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    }

    // Render a single task item in the list
    function renderTask(task) {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.dataset.id = task._id;
        if (task.completed) {
            li.classList.add('completed');
        }

        const textSpan = document.createElement('span');
        textSpan.className = 'text';
        textSpan.textContent = task.text;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '❌';
        deleteBtn.className = 'delete-btn';
        
        actionsDiv.appendChild(deleteBtn);
        li.appendChild(textSpan);
        li.appendChild(actionsDiv);
        taskList.appendChild(li);
    }

    // **UPDATED FUNCTION**
    // Add a new task
    async function addTask() {
        const taskText = taskInput.value.trim();
        if (taskText === '') {
            alert('Task cannot be empty!'); // Give user feedback
            return;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: taskText })
            });

            // Check if the request was successful
            if (!response.ok) {
                // Get error message from body and throw an error
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add task');
            }
            
            const newTask = await response.json();
            renderTask(newTask);
            taskInput.value = '';
        } catch (error) {
            console.error('Error adding task:', error);
            alert(error.message); // Show the error to the user
        }
    }

    // Handle clicks on task items (for completing or deleting)
    async function handleTaskClick(event) {
        const target = event.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;
        
        const taskId = taskItem.dataset.id;

        if (target.classList.contains('delete-btn')) {
            try {
                await fetch(`${API_URL}/${taskId}`, { method: 'DELETE' });
                taskItem.remove();
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        } else if (target.classList.contains('text')) {
            try {
                await fetch(`${API_URL}/${taskId}`, { method: 'PUT' });
                taskItem.classList.toggle('completed');
            } catch (error) {
                console.error('Error updating task:', error);
            }
        }
    }

    // Event Listeners
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    taskList.addEventListener('click', handleTaskClick);

    // Initial fetch of tasks
    fetchTasks();
});