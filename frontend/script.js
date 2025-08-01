document.addEventListener('DOMContentLoaded', async () => {
    // --- AUTHENTICATION CHECK ---
    try {
        const statusResponse = await fetch('/api/status');
        if (statusResponse.status === 401) { // Unauthorized
            window.location.href = '/login.html';
            return;
        }
        const statusData = await statusResponse.json();
        if (!statusData.logged_in) {
            window.location.href = '/login.html';
            return;
        }
        // If logged in, initialize the app
        initializeApp(statusData.user);
    } catch (error) {
        console.error("Auth check failed, redirecting to login.", error);
        window.location.href = '/login.html';
    }
});

function initializeApp(user) {
    // --- Element Selectors ---
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');
    const taskDueDate = document.getElementById('task-due-date');
    const taskDueTime = document.getElementById('task-due-time');
    const taskPriority = document.getElementById('task-priority');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const usernameDisplay = document.getElementById('username-display');
    const body = document.body;
    const searchInput = document.getElementById('search-input');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const sortSelect = document.getElementById('sort-select');
    const taskRecurrence = document.getElementById('task-recurrence');
    const API_URL = '/api/tasks';

    // --- State Variables ---
    let currentFilter = 'all';
    let currentSort = 'default';
    let currentSearchTerm = '';

    // --- INITIALIZE UI ---
    usernameDisplay.textContent = user.username;

    // --- THEME SWITCHER ---
    function applyTheme(theme) {
        body.classList.toggle('dark-theme', theme === 'dark');
        themeToggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
    }

    // --- LOGOUT ---
    async function handleLogout() {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    }

    // --- CORE APP LOGIC ---
    async function fetchTasks() {
        const params = new URLSearchParams({
            filter: currentFilter,
            sortBy: currentSort,
            search: currentSearchTerm
        });
        const requestUrl = `${API_URL}?${params.toString()}`;
        try {
            const response = await fetch(requestUrl);
            const tasks = await response.json();
            renderTaskList(tasks);
        } catch (error) { console.error('Fetch error:', error); }
    }

    function renderTaskList(tasks) {
        taskList.innerHTML = '';
        tasks.forEach(task => taskList.appendChild(createTaskElement(task)));
    }

    function createTaskElement(task) {
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

        const recurrenceIcon = task.recurrence && task.recurrence !== 'none'
            ? `<span class="recurrence-icon" title="Repeats ${task.recurrence}">🔄</span>`
            : '';

        const subtasksHtml = `<div class="subtask-list">${(task.subtasks || []).map(st => createSubtaskElement(st).outerHTML).join('')}</div>`;

        taskElement.innerHTML = `
            <div class="task-main-content">
                <span class="task-complete-btn"></span>
                <div class="task-text-container">
                    <span class="task-text">${escapeHtml(task.text)}</span>
                    ${recurrenceIcon}
                </div>
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

    function createSubtaskElement(subtask) {
        const subtaskElement = document.createElement('div');
        subtaskElement.className = `subtask-item ${subtask.completed ? 'completed' : ''}`;
        subtaskElement.dataset.subtaskId = subtask._id;
        subtaskElement.innerHTML = `
            <span class="subtask-complete-btn"></span>
            <span class="subtask-text">${escapeHtml(subtask.text)}</span>
            <button class="subtask-delete-btn">❌</button>
        `;
        return subtaskElement;
    }

    async function addTask() {
        const taskText = taskInput.value.trim();
        if (!taskText) return;
        const taskData = {
            text: taskText,
            priority: taskPriority.value,
            recurrence: taskRecurrence.value
        };
        const dueDate = taskDueDate.value;
        const dueTime = taskDueTime.value;
        if (dueDate) {
            taskData.dueDate = new Date(`${dueDate}T${dueTime || '00:00'}`).toISOString();
        }
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            await fetchTasks();
            taskInput.value = '';
            taskDueDate.value = '';
            taskDueTime.value = '';
            taskPriority.value = 'medium';
            taskRecurrence.value = 'none';
            taskInput.focus();
        } catch (error) { console.error(error); }
    }
    
    async function saveSubtask(taskId, inputElement) {
        const text = inputElement.value.trim();
        if (!text) return;
        try {
            await fetch(`${API_URL}/${taskId}/subtasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            await fetchTasks();
        } catch (error) { console.error(error); }
    }

    async function toggleCompletion(taskId, subtaskId = null) {
        const url = subtaskId ? `${API_URL}/${taskId}/subtasks/${subtaskId}` : `${API_URL}/${taskId}`;
        try {
            await fetch(url, { method: 'PUT' });
            await fetchTasks();
        } catch (error) { console.error(error); }
    }

    async function deleteTask(taskId, subtaskId = null) {
        const url = subtaskId ? `${API_URL}/${taskId}/subtasks/${subtaskId}` : `${API_URL}/${taskId}`;
        if (!confirm('Are you sure?')) return;
        try {
            await fetch(url, { method: 'DELETE' });
            await fetchTasks();
        } catch (error) { console.error(error); }
    }

    function escapeHtml(str) {
        return str?.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) || '';
    }

    // --- MODIFICATION START: Event Listeners ---
    // Apply saved theme on initial load
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Theme toggle button
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = body.classList.contains('dark-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    });

    // Logout button
    logoutBtn.addEventListener('click', handleLogout);

    // Add Task button and Enter key
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });
    
    // Filter, Sort, and Search controls
    searchInput.addEventListener('input', () => {
        currentSearchTerm = searchInput.value;
        fetchTasks();
    });

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentFilter = button.dataset.filter;
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            fetchTasks();
        });
    });

    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        fetchTasks();
    });
    
    // Event delegation for the entire task list
    taskList.addEventListener('click', (event) => {
        const target = event.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;
        const taskId = taskItem.dataset.id;
        
        if (target.classList.contains('task-complete-btn')) {
            toggleCompletion(taskId);
        }
        if (target.classList.contains('task-delete-btn')) {
            deleteTask(taskId);
        }
        if (target.classList.contains('add-subtask-btn')) {
            const form = taskItem.querySelector('.add-subtask-form');
            form.style.display = form.style.display === 'none' ? 'flex' : 'none';
            if(form.style.display === 'flex') form.querySelector('.subtask-input').focus();
        }
        if (target.classList.contains('save-subtask-btn')) {
            const input = taskItem.querySelector('.subtask-input');
            saveSubtask(taskId, input);
        }

        const subtaskItem = target.closest('.subtask-item');
        if (subtaskItem) {
            const subtaskId = subtaskItem.dataset.subtaskId;
            if (target.classList.contains('subtask-complete-btn')) {
                toggleCompletion(taskId, subtaskId);
            }
            if (target.classList.contains('subtask-delete-btn')) {
                deleteTask(taskId, subtaskId);
            }
        }
    });
    // --- MODIFICATION END ---
    
    fetchTasks(); // Initial fetch of tasks for the logged-in user
}