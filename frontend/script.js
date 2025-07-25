document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/tasks';
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');
    const taskDueDate = document.getElementById('task-due-date');
    const taskDueTime = document.getElementById('task-due-time');
    const taskPriority = document.getElementById('task-priority');

    function showError(message) {
        alert(message);
    }

    // --- Main Fetch and Render ---
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
        const priority = task.priority || 'medium';
        const now = new Date();
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        
        const taskElement = document.createElement('div');
        taskElement.className = `task-item priority-${priority}`;
        taskElement.dataset.id = task._id;

        if (task.completed) taskElement.classList.add('completed');
        if (!task.completed && dueDate && dueDate < now) taskElement.classList.add('overdue');

        const formattedDueDate = dueDate ? `${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not set';

        // Render Subtasks
        const subtasks = task.subtasks || [];
        const subtasksHtml = `
            <div class="subtask-list">
                ${subtasks.map(st => `
                    <div class="subtask-item ${st.completed ? 'completed' : ''}" data-subtask-id="${st._id}">
                        <span class="subtask-complete-btn">✔</span>
                        <span class="subtask-text">${escapeHtml(st.text)}</span>
                        <button class="subtask-delete-btn">❌</button>
                    </div>
                `).join('')}
            </div>
        `;

        taskElement.innerHTML = `
            <div class="task-main-content">
                <span class="task-complete-btn">✔</span>
                <div class="task-details">
                    <span class="task-text">${escapeHtml(task.text)}</span>
                </div>
                <span class="task-duedate">${formattedDueDate}</span>
                <span class="task-priority"><span class="priority-label">${priority.charAt(0).toUpperCase() + priority.slice(1)}</span></span>
                <div class="task-actions">
                    <button class="add-subtask-btn">Subtask +</button>
                    <button class="task-delete-btn">❌</button>
                </div>
            </div>
            <div class="subtask-container">
                ${subtasksHtml}
                <div class="add-subtask-form" style="display:none;">
                    <input type="text" class="subtask-input" placeholder="New subtask...">
                    <button class="save-subtask-btn">Save</button>
                </div>
            </div>
        `;
        taskList.appendChild(taskElement);
    }
    
    // --- API Call Functions ---
    async function addTask() {
        const taskText = taskInput.value.trim();
        if (!taskText) return showError('Task text cannot be empty!');

        const taskData = { text: taskText, priority: taskPriority.value };
        const dueDate = taskDueDate.value;
        const dueTime = taskDueTime.value;
        if (dueDate) {
            taskData.dueDate = new Date(`${dueDate}T${dueTime || '00:00'}`).toISOString();
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            if (!response.ok) throw new Error('Failed to add task');
            await fetchTasks(); // Full refresh
            // Clear inputs
            taskInput.value = '';
            taskDueDate.value = '';
            taskDueTime.value = '';
            taskPriority.value = 'medium';
            taskInput.focus();
        } catch (error) { showError(error.message); }
    }

    async function saveSubtask(taskId, inputElement) {
        const text = inputElement.value.trim();
        if (!text) return showError('Subtask text cannot be empty');

        try {
            const response = await fetch(`${API_URL}/${taskId}/subtasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!response.ok) throw new Error('Failed to add subtask');
            await fetchTasks();
        } catch (error) { showError(error.message); }
    }

    async function toggleCompletion(taskId, subtaskId = null) {
        const url = subtaskId ? `${API_URL}/${taskId}/subtasks/${subtaskId}` : `${API_URL}/${taskId}`;
        try {
            const response = await fetch(url, { method: 'PUT' });
            if (!response.ok) throw new Error('Failed to update status');
            await fetchTasks();
        } catch (error) { showError(error.message); }
    }

    async function deleteTask(taskId, subtaskId = null) {
        const url = subtaskId ? `${API_URL}/${taskId}/subtasks/${subtaskId}` : `${API_URL}/${taskId}`;
        const confirmation = confirm(`Are you sure you want to delete this ${subtaskId ? 'subtask' : 'task and all its subtasks'}?`);
        if (!confirmation) return;
        
        try {
            const response = await fetch(url, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete');
            await fetchTasks();
        } catch (error) { showError(error.message); }
    }

    // --- Event Handling ---
    taskList.addEventListener('click', (event) => {
        const target = event.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;
        const taskId = taskItem.dataset.id;
        
        // Main Task Actions
        if (target.classList.contains('task-complete-btn')) toggleCompletion(taskId);
        if (target.classList.contains('task-delete-btn')) deleteTask(taskId);
        
        // Subtask Form
        if (target.classList.contains('add-subtask-btn')) {
            const form = taskItem.querySelector('.add-subtask-form');
            form.style.display = form.style.display === 'none' ? 'flex' : 'none';
            form.querySelector('.subtask-input').focus();
        }
        if (target.classList.contains('save-subtask-btn')) {
            const input = taskItem.querySelector('.subtask-input');
            saveSubtask(taskId, input);
        }

        // Subtask Actions
        const subtaskItem = target.closest('.subtask-item');
        if (subtaskItem) {
            const subtaskId = subtaskItem.dataset.subtaskId;
            if (target.classList.contains('subtask-complete-btn')) toggleCompletion(taskId, subtaskId);
            if (target.classList.contains('subtask-delete-btn')) deleteTask(taskId, subtaskId);
        }
    });

    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => e.key === 'Enter' && addTask());

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }
    
    fetchTasks(); // Initial Load
});