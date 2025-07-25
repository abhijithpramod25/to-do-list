document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/tasks';
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');
    const taskDueDate = document.getElementById('task-due-date');
    const taskDueTime = document.getElementById('task-due-time');
    const taskPriority = document.getElementById('task-priority');
    // --- MODIFICATION START ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;
    // --- MODIFICATION END ---


    // --- THEME SWITCHER LOGIC ---
    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-theme');
            themeToggleBtn.textContent = '🌙';
        } else {
            body.classList.remove('dark-theme');
            themeToggleBtn.textContent = '☀️';
        }
    }

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = body.classList.contains('dark-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    });

    // Apply saved theme on initial load
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    // --- THEME SWITCHER LOGIC END ---


    async function fetchTasks() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Failed to fetch tasks');
            const tasks = await response.json();
            renderTaskList(tasks);
        } catch (error) { console.error(error); }
    }

    function renderTaskList(tasks) {
        taskList.innerHTML = '';
        tasks.forEach(task => {
            const taskElement = createTaskElement(task);
            taskList.appendChild(taskElement);
        });
    }

    function createTaskElement(task) {
        // This function remains unchanged from the previous version
        const taskElement = document.createElement('div');
        const priority = task.priority || 'medium';
        taskElement.className = `task-item priority-${priority}`;
        taskElement.dataset.id = task._id;
        
        const now = new Date();
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        if (task.completed) {
            taskElement.classList.add('completed');
        } else if (dueDate && dueDate < now) {
            taskElement.classList.add('overdue');
        }
        const formattedDueDate = dueDate ? `${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not set';
        
        const subtasks = task.subtasks || [];
        const subtasksHtml = `<div class="subtask-list">${subtasks.map(st => `
            <div class="subtask-item ${st.completed ? 'completed' : ''}" data-subtask-id="${st._id}">
                <span class="subtask-complete-btn"></span>
                <span class="subtask-text">${escapeHtml(st.text)}</span>
                <button class="subtask-delete-btn">❌</button>
            </div>`).join('')}</div>`;

        taskElement.innerHTML = `
            <div class="task-main-content">
                <span class="task-complete-btn"></span>
                <span class="task-text">${escapeHtml(task.text)}</span>
                <span class="task-duedate">${formattedDueDate}</span>
                <span class="task-priority"><span class="priority-label">${priority.charAt(0).toUpperCase() + priority.slice(1)}</span></span>
                <div class="task-actions">
                    <button class="add-subtask-btn">Add Subtask</button>
                    <button class="task-delete-btn">❌</button>
                </div>
            </div>
            <div class="subtask-container">${subtasksHtml}<div class="add-subtask-form" style="display:none;"><input type="text" class="subtask-input" placeholder="New subtask..."><button class="save-subtask-btn">Save</button></div></div>`;
        return taskElement;
    }

    async function addTask() {
        // This function remains unchanged
        const taskText = taskInput.value.trim();
        if (!taskText) return;
        
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
            await fetchTasks();
            taskInput.value = '';
            taskDueDate.value = '';
            taskDueTime.value = '';
            taskPriority.value = 'medium';
            taskInput.focus();
        } catch (error) { console.error(error); }
    }
    
    // --- Other functions (saveSubtask, toggleCompletion, deleteTask, etc.) remain unchanged ---
    async function saveSubtask(taskId, inputElement) {
        const text = inputElement.value.trim();
        if (!text) return;
        try {
            const response = await fetch(`${API_URL}/${taskId}/subtasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!response.ok) throw new Error('Failed to add subtask');
            await fetchTasks();
        } catch (error) { console.error(error); }
    }
    async function toggleCompletion(taskId, subtaskId = null) {
        const url = subtaskId ? `${API_URL}/${taskId}/subtasks/${subtaskId}` : `${API_URL}/${taskId}`;
        try {
            const response = await fetch(url, { method: 'PUT' });
            if (!response.ok) throw new Error('Failed to update status');
            await fetchTasks();
        } catch (error) { console.error(error); }
    }
    async function deleteTask(taskId, subtaskId = null) {
        const url = subtaskId ? `${API_URL}/${taskId}/subtasks/${subtaskId}` : `${API_URL}/${taskId}`;
        if (!confirm('Are you sure?')) return;
        try {
            const response = await fetch(url, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete');
            await fetchTasks();
        } catch (error) { console.error(error); }
    }
    taskList.addEventListener('click', (event) => {
        const target = event.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;
        const taskId = taskItem.dataset.id;
        if (target.classList.contains('task-complete-btn')) toggleCompletion(taskId);
        if (target.classList.contains('task-delete-btn')) deleteTask(taskId);
        if (target.classList.contains('add-subtask-btn')) {
            const form = taskItem.querySelector('.add-subtask-form');
            form.style.display = form.style.display === 'none' ? 'flex' : 'none';
        }
        if (target.classList.contains('save-subtask-btn')) {
            const input = taskItem.querySelector('.subtask-input');
            saveSubtask(taskId, input);
        }
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
        return str?.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) || '';
    }
    
    fetchTasks();
});