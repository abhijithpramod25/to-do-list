    document.addEventListener('DOMContentLoaded', () => {
        const API_URL = '/api/tasks';
        const taskInput = document.getElementById('task-input');
        const addTaskBtn = document.getElementById('add-task-btn');
        const taskList = document.getElementById('task-list');
        const datetimeContainer = document.getElementById('datetime-container');
        const errorContainer = document.getElementById('error-container');

        /**
         * Display an error message in the UI.
         * @param {string} message
         */
        function showError(message) {
            if (errorContainer) {
                errorContainer.textContent = message;
                errorContainer.style.display = 'block';
                setTimeout(() => {
                    errorContainer.style.display = 'none';
                }, 3000);
            } else {
                alert(message);
            }
        }

        /**
         * Update the date and time in the UI.
         */
        function updateDateTime() {
            const now = new Date();
            const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const date = now.toLocaleDateString(undefined, dateOptions);
            const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            if (datetimeContainer) {
                datetimeContainer.textContent = `${date} | ${time}`;
            }
        }

        /**
         * Fetch all tasks from the server and render them.
         */
        async function fetchTasks() {
            try {
                const response = await fetch(API_URL);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch tasks');
                }
                const tasks = await response.json();
                renderTaskList(tasks);
            } catch (error) {
                console.error('Error fetching tasks:', error);
                showError(`Failed to load tasks: ${error.message}`);
            }
        }

        /**
         * Render the list of tasks.
         * @param {Array} tasks
         */
        function renderTaskList(tasks) {
            taskList.innerHTML = '';
            tasks.forEach(renderTask);
        }

        /**
         * Render a single task item in the table.
         * @param {Object} task
         */
        function renderTask(task) {
            const tr = document.createElement('tr');
            tr.className = 'task-item';
            tr.dataset.id = task._id;
            if (task.completed) tr.classList.add('completed');

            tr.innerHTML = `
                <td>
                    <span class="text">${escapeHtml(task.text)}</span>
                </td>
                <td class="actions">
                    <button class="delete-btn" title="Delete Task">❌</button>
                </td>
            `;
            taskList.appendChild(tr);
        }

        /**
         * Escape HTML to prevent XSS.
         * @param {string} str
         * @returns {string}
         */
        function escapeHtml(str) {
            return str.replace(/[&<>"']/g, (m) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[m]);
        }

        /**
         * Add a new task.
         */
        async function addTask() {
            const taskText = taskInput.value.trim();
            if (!taskText) {
                showError('Task cannot be empty!');
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
                    throw new Error(errorData.error || 'Failed to add task');
                }

                const newTask = await response.json();
                renderTask(newTask);
                taskInput.value = '';
                taskInput.focus();
            } catch (error) {
                console.error('Error adding task:', error);
                showError(error.message);
            }
        }

        /**
         * Handle clicks on task items (for completing or deleting).
         * @param {MouseEvent} event
         */
        async function handleTaskClick(event) {
            const target = event.target;
            const taskItem = target.closest('.task-item');
            if (!taskItem) return;

            const taskId = taskItem.dataset.id;

            if (target.classList.contains('delete-btn')) {
                await deleteTask(taskId, taskItem);
            } else if (target.classList.contains('text')) {
                await toggleTaskCompletion(taskId, taskItem);
            }
        }

        /**
         * Delete a task.
         * @param {string} taskId
         * @param {HTMLElement} taskItem
         */
        async function deleteTask(taskId, taskItem) {
            try {
                const response = await fetch(`${API_URL}/${taskId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Failed to delete task');
                taskItem.remove();
            } catch (error) {
                console.error('Error deleting task:', error);
                showError('Could not delete task.');
            }
        }

        /**
         * Toggle task completion.
         * @param {string} taskId
         * @param {HTMLElement} taskItem
         */
        async function toggleTaskCompletion(taskId, taskItem) {
            try {
                const response = await fetch(`${API_URL}/${taskId}`, { method: 'PUT' });
                if (!response.ok) throw new Error('Failed to update task');
                taskItem.classList.toggle('completed');
            } catch (error) {
                console.error('Error updating task:', error);
                showError('Could not update task.');
            }
        }

        // Event Listeners
        addTaskBtn.addEventListener('click', addTask);
        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTask();
        });
        taskList.addEventListener('click', handleTaskClick);

        // Initial fetch of tasks and start the clock
        fetchTasks();
        updateDateTime();
        setInterval(updateDateTime, 1000);
    });