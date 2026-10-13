// =========================================================
// ABS611 Board - application logic (vanilla JavaScript)
// Pattern used everywhere: change the tasks list -> save -> redraw
// =========================================================

// Application State: load saved tasks, or start with an empty list
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

// DOM Element References
const taskForm = document.getElementById('task-form');
const taskTitle = document.getElementById('task-title');
const taskDescription = document.getElementById('task-description');
const taskCategory = document.getElementById('task-category');
const taskPriority = document.getElementById('task-priority');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const themeToggle = document.getElementById('theme-toggle');
const columns = document.querySelectorAll('.column');

// Text shown inside a column that has no cards
const EMPTY_MESSAGES = {
  'todo': 'No tasks yet. Add one above.',
  'in-progress': 'Move a card here when you start it.',
  'completed': 'Finished tasks land here.'
};

// Apply the saved theme straight away (dark is the default)
applyTheme(localStorage.getItem('theme') || 'dark');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderTasks();
  taskForm.addEventListener('submit', handleAddTask);
  searchInput.addEventListener('input', renderTasks);
  categoryFilter.addEventListener('change', renderTasks);
  themeToggle.addEventListener('click', toggleTheme);
  setUpDropZones();
});

// Save tasks to localStorage
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Add a new task
function handleAddTask(e) {
  e.preventDefault();

  const newTask = {
    id: Date.now().toString(),
    title: taskTitle.value.trim(),
    description: taskDescription.value.trim(),
    category: taskCategory.value,
    priority: taskPriority.value,
    status: 'todo'
  };

  // Don't add a task whose title is only spaces
  if (!newTask.title) return;

  tasks.push(newTask);
  saveTasks();
  renderTasks();

  // Reset form fields
  taskForm.reset();
}

// Update status of a task (used by the dropdown AND by drag and drop)
function updateTaskStatus(id, newStatus) {
  tasks = tasks.map(task =>
    task.id === id ? { ...task, status: newStatus } : task
  );
  saveTasks();
  renderTasks();
}

// Delete a task
function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveTasks();
  renderTasks();
}

// Render tasks onto the board based on status and filters
function renderTasks() {
  const searchTerm = searchInput.value.toLowerCase();
  const selectedCategory = categoryFilter.value;

  // Clear lists
  const lists = {
    'todo': document.getElementById('list-todo'),
    'in-progress': document.getElementById('list-in-progress'),
    'completed': document.getElementById('list-completed')
  };

  Object.values(lists).forEach(list => list.innerHTML = '');

  // Track counts
  const counts = { 'todo': 0, 'in-progress': 0, 'completed': 0 };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm);
    const matchesCategory = selectedCategory === 'All' || task.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Append elements
  filteredTasks.forEach(task => {
    counts[task.status]++;
    const cardHtml = createTaskCard(task);
    if (lists[task.status]) {
      lists[task.status].appendChild(cardHtml);
    }
  });

  // Show a short message in any column that ended up empty
  Object.entries(lists).forEach(([status, list]) => {
    if (counts[status] === 0) {
      const message = document.createElement('p');
      message.className = 'empty-column';
      message.textContent = (searchTerm || selectedCategory !== 'All')
        ? 'No tasks match your search.'
        : EMPTY_MESSAGES[status];
      list.appendChild(message);
    }
  });

  // Update counts in DOM
  document.getElementById('count-todo').textContent = counts['todo'];
  document.getElementById('count-in-progress').textContent = counts['in-progress'];
  document.getElementById('count-completed').textContent = counts['completed'];

  // Header counter: active vs completed, counted from ALL tasks (search/filter don't change it)
  const completedCount = tasks.filter(task => task.status === 'completed').length;
  document.getElementById('count-active').textContent = tasks.length - completedCount;
  document.getElementById('count-done').textContent = completedCount;
}

// Helper: Create Task DOM element
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.setAttribute('data-priority', task.priority);

  // Drag and drop: the card can be picked up with the mouse
  card.draggable = true;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', task.id); // remember WHICH task is being dragged
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  card.innerHTML = `
    <div class="task-card-title">${escapeHtml(task.title)}</div>
    ${task.description ? `<p class="task-card-description">${escapeHtml(task.description)}</p>` : ''}
    <div class="task-meta">
      <span>${escapeHtml(task.category)}</span>
      <span>${escapeHtml(task.priority)} Priority</span>
    </div>
    <div class="task-actions">
      <select aria-label="Move task" onchange="updateTaskStatus('${task.id}', this.value)">
        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
        <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
      </select>
      <button class="btn-danger" onclick="deleteTask('${task.id}')">Delete</button>
    </div>
  `;

  return card;
}

// Drag and drop: make each column accept dropped cards
function setUpDropZones() {
  columns.forEach(column => {
    // dragover fires again and again while a card is held over the column.
    // preventDefault() tells the browser "dropping here is allowed".
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('drag-over');
    });

    // Remove the highlight only when the mouse really leaves the column
    // (not when it just moves over a card inside it)
    column.addEventListener('dragleave', (e) => {
      if (!column.contains(e.relatedTarget)) {
        column.classList.remove('drag-over');
      }
    });

    // The card is let go: move the task to this column's status
    column.addEventListener('drop', (e) => {
      e.preventDefault();
      column.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      if (id) {
        updateTaskStatus(id, column.dataset.status); // reads data-status="todo" etc. from the HTML
      }
    });
  });
}

// Theme: switch between dark and light, and remember the choice
function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme;
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  localStorage.setItem('theme', newTheme);
}

function applyTheme(theme) {
  // Sets <html data-theme="light"> or <html data-theme="dark">; the CSS does the rest
  document.documentElement.dataset.theme = theme;
  // The button says what will happen when you click it
  themeToggle.textContent = theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode';
}

// Security: turn special characters into safe text, so typed HTML can't run
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
