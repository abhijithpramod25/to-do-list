document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/tasks';
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');
    const taskDueDate = document.getElementById('task-due-date');
    const taskDueTime = document.getElementById('task-due-time');
    // --- MODIFICATION START ---
    const taskPriority = document.getElementById('task-priority');
    // --- MODIFICATION END ---

    function showError(message) {
        alert(message);
    }

    async function fetchTasks() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Failed to fetch tasks');
            const tasks = await response.json();
            renderTaskList(tasks);
        } catch (error) {
            showError(error.message);
        }
    }

    function renderTaskList(tasks) {
        taskList.innerHTML = '';
        tasks.forEach(renderTask);
    }

    function renderTask(task) {
        const tr = document.createElement('tr');
        tr.className = 'task-item';
        tr.dataset.id = task._id;

        // --- MODIFICATION START ---
        // Add a class based on the task's priority
        const priority = task.priority || 'medium'; // Default to medium if not set
        tr.classList.add(`priority-${priority}`);
        // --- MODIFICATION END ---

        const now = new Date();
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;

        if (task.completed) {
            tr.classList.add('completed');
        } else if (dueDate && dueDate < now) {
            tr.classList.add('overdue');
        }

        const formattedDueDate = dueDate
            ? `${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'No due date';

        tr.innerHTML = `
            <td><span class="complete-btn" title="Mark as complete">✔</span></td>
            <td><span class="text">${escapeHtml(task.text)}</span></td>
            <td class="due-date-cell">${formattedDueDate}</td>
            <td><span class="priority-label">${priority.charAt(0).toUpperCase() + priority.slice(1)}</span></td>
            <td class="actions"><button class="delete-btn" title="Delete Task">❌</button></td>
        `;
        taskList.appendChild(tr);
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    async function addTask() {
        const taskText = taskInput.value.trim();
        if (!taskText) {
            showError('Task cannot be empty!');
            return;
        }

        const taskData = {
            text: taskText,
            // --- MODIFICATION START ---
            priority: taskPriority.value
            // --- MODIFICATION END ---
        };

        const dueDate = taskDueDate.value;
        const dueTime = taskDueTime.value;
        if (dueDate && dueTime) {
            taskData.dueDate = new Date(`${dueDate}T${dueTime}`).toISOString();
        } else if (dueDate) {
            taskData.dueDate = new Date(dueDate).toISOString();
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            if (!response.ok) throw new Error('Failed to add task');
            const newTask = await response.json();
            renderTask(newTask);
            // Clear inputs
            taskInput.value = '';
            taskDueDate.value = '';
            taskDueTime.value = '';
            taskPriority.value = 'medium';
            taskInput.focus();
        } catch (error) {
            showError(error.message);
        }
    }

    async function handleTaskClick(event) {
        const target = event.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;
        const taskId = taskItem.dataset.id;

        if (target.classList.contains('delete-btn')) {
            await deleteTask(taskId, taskItem);
        } else if (target.matches('.complete-btn, .text')) {
            await toggleTaskCompletion(taskId);
        }
    }

    async function deleteTask(taskId, taskItem) {
        try {
            const response = await fetch(`${API_URL}/${taskId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete task');
            taskItem.remove();
        } catch (error) {
            showError('Could not delete task.');
        }
    }

    async function toggleTaskCompletion(taskId) {
        try {
            const response = await fetch(`${API_URL}/${taskId}`, { method: 'PUT' });
            if (!response.ok) throw new Error('Failed to update task');
            await fetchTasks(); // Re-fetch all tasks to ensure UI is consistent
        } catch (error) {
            showError('Could not update task.');
        }
    }

    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    taskList.addEventListener('click', handleTaskClick);

    fetchTasks();
});