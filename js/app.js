/**
 * Life Dashboard — app.js
 * Pure vanilla JS, ES6+. No frameworks, no dependencies.
 * All data persisted to localStorage.
 */

'use strict';

/* ============================================================
   Constants — localStorage keys
   ============================================================ */
const KEYS = {
  TASKS: 'dashboard_tasks',
  LINKS: 'dashboard_links',
  THEME: 'dashboard_theme',
  USERNAME: 'dashboard_username',
  POMODORO_DURATION: 'dashboard_pomodoro_duration',
};

/* ============================================================
   Utility helpers
   ============================================================ */

/** Generate a simple unique ID */
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Read JSON from localStorage, return fallback on error */
const lsGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

/** Write value as JSON to localStorage */
const lsSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`localStorage write failed for key "${key}":`, err);
  }
};

/** Pad a number to 2 digits */
const pad2 = (n) => String(n).padStart(2, '0');

/** Show an element by removing the 'hidden' class */
const show = (el) => el.classList.remove('hidden');

/** Hide an element by adding the 'hidden' class */
const hide = (el) => el.classList.add('hidden');

/* ============================================================
   Feature 1 — Clock & Greeting
   ============================================================ */

const clockTimeEl = document.getElementById('clock-time');
const clockDateEl = document.getElementById('clock-date');
const greetingTextEl = document.getElementById('greeting-text');
const greetingNameEl = document.getElementById('greeting-name');

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Return greeting prefix based on hour */
const getGreeting = (hour) => {
  if (hour >= 5  && hour <= 11) return 'Good Morning';
  if (hour >= 12 && hour <= 17) return 'Good Afternoon';
  if (hour >= 18 && hour <= 20) return 'Good Evening';
  return 'Good Night';
};

/** Update clock and greeting every tick */
const updateClock = () => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  clockTimeEl.textContent = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;

  const day   = DAYS[now.getDay()];
  const date  = now.getDate();
  const month = MONTHS[now.getMonth()];
  const year  = now.getFullYear();
  clockDateEl.textContent = `${day}, ${month} ${date}, ${year}`;

  const greeting = getGreeting(h);
  greetingTextEl.textContent = `${greeting},`;
};

/** Load saved name and render it */
const loadUsername = () => {
  const name = lsGet(KEYS.USERNAME, null) || 'User';
  greetingNameEl.textContent = `${name}!`;
};

/* --- Name edit modal --- */
const modalName       = document.getElementById('modal-name');
const modalNameInput  = document.getElementById('modal-name-input');
const modalNameSave   = document.getElementById('modal-name-save');
const modalNameCancel = document.getElementById('modal-name-cancel');
const editNameBtn     = document.getElementById('edit-name-btn');

const openNameModal = () => {
  const current = lsGet(KEYS.USERNAME, '') || '';
  modalNameInput.value = current === 'User' ? '' : current;
  show(modalName);
  modalNameInput.focus();
};

const closeNameModal = () => {
  hide(modalName);
};

const saveName = () => {
  const name = modalNameInput.value.trim() || 'User';
  lsSet(KEYS.USERNAME, name);
  greetingNameEl.textContent = `${name}!`;
  closeNameModal();
};

editNameBtn.addEventListener('click', openNameModal);
greetingNameEl.addEventListener('click', openNameModal);
greetingNameEl.style.cursor = 'pointer';

modalNameSave.addEventListener('click', saveName);
modalNameCancel.addEventListener('click', closeNameModal);

modalNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveName();
  if (e.key === 'Escape') closeNameModal();
});

// Close modal on overlay click
modalName.addEventListener('click', (e) => {
  if (e.target === modalName) closeNameModal();
});

/* ============================================================
   Feature 2 — Focus Timer (Pomodoro)
   ============================================================ */

const timerDisplayEl     = document.getElementById('timer-display');
const timerStartPauseBtn = document.getElementById('timer-start-pause');
const timerResetBtn      = document.getElementById('timer-reset');
const timerDurationInput = document.getElementById('timer-duration-input');
const timerSetBtn        = document.getElementById('timer-set-btn');
const timerNotification  = document.getElementById('timer-notification');
const timerNotifClose    = document.getElementById('timer-notif-close');

let timerInterval   = null;
let timerRunning    = false;
let timerTotalSecs  = 0;
let timerRemaining  = 0;

/** Load saved pomodoro duration (minutes) */
const loadTimerDuration = () => {
  const saved = lsGet(KEYS.POMODORO_DURATION, 25);
  const mins = Number.isInteger(saved) && saved >= 1 && saved <= 120 ? saved : 25;
  timerDurationInput.value = mins;
  setTimerDuration(mins, false);
};

/** Set timer to given minutes, optionally save */
const setTimerDuration = (mins, save = true) => {
  stopTimer();
  timerTotalSecs   = mins * 60;
  timerRemaining   = timerTotalSecs;
  renderTimer();
  hide(timerNotification);
  if (save) lsSet(KEYS.POMODORO_DURATION, mins);
};

/** Render current remaining time as MM:SS */
const renderTimer = () => {
  const m = Math.floor(timerRemaining / 60);
  const s = timerRemaining % 60;
  timerDisplayEl.textContent = `${pad2(m)}:${pad2(s)}`;
};

/** Play a short beep using the Web Audio API */
const playBeep = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx  = new AudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
  } catch (err) {
    console.warn('Web Audio API not available:', err);
  }
};

/** Called when countdown reaches zero */
const onTimerComplete = () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning  = false;
  timerStartPauseBtn.textContent = 'Start';
  timerStartPauseBtn.setAttribute('aria-label', 'Start timer');
  playBeep();
  show(timerNotification);
  timerNotification.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

/** Tick — decrement remaining by 1 second */
const timerTick = () => {
  if (timerRemaining <= 0) {
    onTimerComplete();
    return;
  }
  timerRemaining--;
  renderTimer();
};

/** Start or pause the timer */
const startPauseTimer = () => {
  if (timerRunning) {
    // Pause
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning  = false;
    timerStartPauseBtn.textContent = 'Resume';
    timerStartPauseBtn.setAttribute('aria-label', 'Resume timer');
  } else {
    // Start / Resume
    if (timerRemaining <= 0) {
      // Restart from full duration
      const mins = parseInt(timerDurationInput.value, 10) || 25;
      timerRemaining = mins * 60;
    }
    timerRunning  = true;
    timerInterval = setInterval(timerTick, 1000);
    timerStartPauseBtn.textContent = 'Pause';
    timerStartPauseBtn.setAttribute('aria-label', 'Pause timer');
    hide(timerNotification);
  }
};

/** Stop and reset timer */
const stopTimer = () => {
  clearInterval(timerInterval);
  timerInterval  = null;
  timerRunning   = false;
  timerRemaining = timerTotalSecs;
  timerStartPauseBtn.textContent = 'Start';
  timerStartPauseBtn.setAttribute('aria-label', 'Start timer');
  renderTimer();
};

timerStartPauseBtn.addEventListener('click', startPauseTimer);
timerResetBtn.addEventListener('click', () => {
  hide(timerNotification);
  stopTimer();
});

timerSetBtn.addEventListener('click', () => {
  const val = parseInt(timerDurationInput.value, 10);
  if (!val || val < 1 || val > 120) {
    timerDurationInput.focus();
    return;
  }
  setTimerDuration(val, true);
});

timerDurationInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') timerSetBtn.click();
});

timerNotifClose.addEventListener('click', () => hide(timerNotification));

/* ============================================================
   Feature 3 — To-Do List
   ============================================================ */

const todoInput  = document.getElementById('todo-input');
const todoAddBtn = document.getElementById('todo-add-btn');
const todoListEl = document.getElementById('todo-list');
const todoError  = document.getElementById('todo-error');

let tasks = []; // In-memory array of {id, text, done, createdAt}

/** Load tasks from localStorage */
const loadTasks = () => {
  tasks = lsGet(KEYS.TASKS, []);
  renderTasks();
};

/** Save tasks to localStorage */
const saveTasks = () => lsSet(KEYS.TASKS, tasks);

/** Render all tasks into the DOM */
const renderTasks = () => {
  todoListEl.innerHTML = '';
  if (tasks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'todo-item';
    empty.style.justifyContent = 'center';
    empty.style.color = 'var(--text-secondary)';
    empty.style.fontSize = '0.88rem';
    empty.textContent = 'No tasks yet. Add one above!';
    todoListEl.appendChild(empty);
    return;
  }
  tasks.forEach((task) => {
    todoListEl.appendChild(createTaskEl(task));
  });
};

/** Create a single task list item element */
const createTaskEl = (task) => {
  const li = document.createElement('li');
  li.className = `todo-item${task.done ? ' done' : ''}`;
  li.dataset.id = task.id;
  li.setAttribute('role', 'listitem');

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-checkbox';
  checkbox.checked = task.done;
  checkbox.setAttribute('aria-label', `Mark "${task.text}" as ${task.done ? 'incomplete' : 'complete'}`);
  checkbox.addEventListener('change', () => toggleTask(task.id));

  // Task text
  const span = document.createElement('span');
  span.className = 'todo-text';
  span.textContent = task.text;
  span.title = task.text;

  // Actions container
  const actions = document.createElement('div');
  actions.className = 'todo-actions';

  // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-todo-action edit';
  editBtn.setAttribute('aria-label', `Edit task: ${task.text}`);
  editBtn.title = 'Edit';
  editBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>`;
  editBtn.addEventListener('click', () => openEditTaskModal(task.id));

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'btn-todo-action delete';
  delBtn.setAttribute('aria-label', `Delete task: ${task.text}`);
  delBtn.title = 'Delete';
  delBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>`;
  delBtn.addEventListener('click', () => deleteTask(task.id));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  li.appendChild(checkbox);
  li.appendChild(span);
  li.appendChild(actions);

  return li;
};

/** Show a brief error message and shake animation */
const showTodoError = (msg, container = todoError) => {
  container.textContent = msg;
  show(container);
  // Re-trigger animation by cloning
  container.style.animation = 'none';
  // Force reflow
  void container.offsetHeight;
  container.style.animation = '';
  setTimeout(() => hide(container), 3000);
};

/** Add a new task */
const addTask = () => {
  const text = todoInput.value.trim();
  if (!text) return;

  const duplicate = tasks.some(
    (t) => t.text.toLowerCase() === text.toLowerCase()
  );

  if (duplicate) {
    showTodoError('Task already exists!', todoError);
    todoInput.focus();
    return;
  }

  const task = {
    id: genId(),
    text,
    done: false,
    createdAt: new Date().toISOString(),
  };

  tasks.push(task);
  saveTasks();
  renderTasks();
  todoInput.value = '';
  todoInput.focus();
};

/** Toggle task done state */
const toggleTask = (id) => {
  tasks = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  saveTasks();
  renderTasks();
};

/** Delete a task by id */
const deleteTask = (id) => {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  renderTasks();
};

/* --- Edit task modal --- */
const modalTodoEdit   = document.getElementById('modal-todo-edit');
const modalTodoInput  = document.getElementById('modal-todo-input');
const modalTodoSave   = document.getElementById('modal-todo-save');
const modalTodoCancel = document.getElementById('modal-todo-cancel');
const modalTodoError  = document.getElementById('modal-todo-error');

let editingTaskId = null;

const openEditTaskModal = (id) => {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  editingTaskId = id;
  modalTodoInput.value = task.text;
  hide(modalTodoError);
  show(modalTodoEdit);
  modalTodoInput.focus();
  modalTodoInput.select();
};

const closeEditTaskModal = () => {
  editingTaskId = null;
  hide(modalTodoEdit);
};

const saveEditTask = () => {
  const newText = modalTodoInput.value.trim();
  if (!newText) return;

  const duplicate = tasks.some(
    (t) => t.id !== editingTaskId && t.text.toLowerCase() === newText.toLowerCase()
  );

  if (duplicate) {
    showTodoError('Task already exists!', modalTodoError);
    return;
  }

  tasks = tasks.map((t) =>
    t.id === editingTaskId ? { ...t, text: newText } : t
  );
  saveTasks();
  renderTasks();
  closeEditTaskModal();
};

modalTodoSave.addEventListener('click', saveEditTask);
modalTodoCancel.addEventListener('click', closeEditTaskModal);
modalTodoEdit.addEventListener('click', (e) => {
  if (e.target === modalTodoEdit) closeEditTaskModal();
});
modalTodoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveEditTask();
  if (e.key === 'Escape') closeEditTaskModal();
});

// Wire up add task controls
todoAddBtn.addEventListener('click', addTask);
todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTask();
});

/* ============================================================
   Feature 4 — Quick Links
   ============================================================ */

const linksGridEl  = document.getElementById('links-grid');
const addLinkBtn   = document.getElementById('add-link-btn');

const DEFAULT_LINKS = [
  { id: genId(), name: 'Google',  url: 'https://google.com' },
  { id: genId(), name: 'YouTube', url: 'https://youtube.com' },
  { id: genId(), name: 'GitHub',  url: 'https://github.com' },
  { id: genId(), name: 'ChatGPT', url: 'https://chat.openai.com' },
];

let links = [];

/** Load links from localStorage (or defaults if empty) */
const loadLinks = () => {
  const saved = lsGet(KEYS.LINKS, null);
  if (!saved || !Array.isArray(saved) || saved.length === 0) {
    links = DEFAULT_LINKS;
    saveLinks();
  } else {
    links = saved;
  }
  renderLinks();
};

/** Save links to localStorage */
const saveLinks = () => lsSet(KEYS.LINKS, links);

/** Get favicon URL for a given link URL */
const getFaviconUrl = (url) => {
  try {
    const origin = new URL(url).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
};

/** Get first letter for fallback favicon */
const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : '?');

/** Render link cards into the grid */
const renderLinks = () => {
  linksGridEl.innerHTML = '';
  links.forEach((link) => {
    linksGridEl.appendChild(createLinkCard(link));
  });
};

/** Create a link card element */
const createLinkCard = (link) => {
  const anchor = document.createElement('a');
  anchor.href   = link.url;
  anchor.target = '_blank';
  anchor.rel    = 'noopener noreferrer';
  anchor.className = 'link-card';
  anchor.setAttribute('role', 'listitem');
  anchor.setAttribute('aria-label', `Open ${link.name}`);

  // Favicon with fallback
  const faviconUrl = getFaviconUrl(link.url);
  let faviconEl;

  if (faviconUrl) {
    faviconEl = document.createElement('img');
    faviconEl.src     = faviconUrl;
    faviconEl.alt     = '';
    faviconEl.className = 'link-favicon';
    faviconEl.setAttribute('aria-hidden', 'true');
    faviconEl.addEventListener('error', () => {
      // Replace broken img with initial fallback
      const fallback = document.createElement('div');
      fallback.className = 'link-favicon-fallback';
      fallback.setAttribute('aria-hidden', 'true');
      fallback.textContent = getInitial(link.name);
      faviconEl.replaceWith(fallback);
    });
  } else {
    faviconEl = document.createElement('div');
    faviconEl.className = 'link-favicon-fallback';
    faviconEl.setAttribute('aria-hidden', 'true');
    faviconEl.textContent = getInitial(link.name);
  }

  const nameEl = document.createElement('span');
  nameEl.className = 'link-name';
  nameEl.textContent = link.name;

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'link-delete-btn';
  delBtn.setAttribute('aria-label', `Remove ${link.name}`);
  delBtn.title = `Remove ${link.name}`;
  delBtn.textContent = '×';
  delBtn.addEventListener('click', (e) => {
    e.preventDefault(); // don't follow the link
    e.stopPropagation();
    deleteLink(link.id);
  });

  anchor.appendChild(faviconEl);
  anchor.appendChild(nameEl);
  anchor.appendChild(delBtn);

  return anchor;
};

/** Delete a link by id */
const deleteLink = (id) => {
  links = links.filter((l) => l.id !== id);
  saveLinks();
  renderLinks();
};

/* --- Add link modal --- */
const modalLink       = document.getElementById('modal-link');
const modalLinkName   = document.getElementById('modal-link-name');
const modalLinkUrl    = document.getElementById('modal-link-url');
const modalLinkSave   = document.getElementById('modal-link-save');
const modalLinkCancel = document.getElementById('modal-link-cancel');
const modalLinkError  = document.getElementById('modal-link-error');

const openAddLinkModal = () => {
  modalLinkName.value = '';
  modalLinkUrl.value  = '';
  hide(modalLinkError);
  show(modalLink);
  modalLinkName.focus();
};

const closeAddLinkModal = () => {
  hide(modalLink);
};

const isValidUrl = (str) => {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const saveNewLink = () => {
  const name = modalLinkName.value.trim();
  let   url  = modalLinkUrl.value.trim();

  // Auto-prepend https:// if no protocol
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  if (!name || !isValidUrl(url)) {
    show(modalLinkError);
    return;
  }

  hide(modalLinkError);

  const link = { id: genId(), name, url };
  links.push(link);
  saveLinks();
  renderLinks();
  closeAddLinkModal();
};

addLinkBtn.addEventListener('click', openAddLinkModal);
modalLinkSave.addEventListener('click', saveNewLink);
modalLinkCancel.addEventListener('click', closeAddLinkModal);
modalLink.addEventListener('click', (e) => {
  if (e.target === modalLink) closeAddLinkModal();
});

modalLinkName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') modalLinkUrl.focus();
  if (e.key === 'Escape') closeAddLinkModal();
});

modalLinkUrl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveNewLink();
  if (e.key === 'Escape') closeAddLinkModal();
});

/* ============================================================
   Challenge 1 — Light / Dark Mode Toggle
   ============================================================ */

const themeToggleBtn = document.getElementById('theme-toggle');
const themeIconEl    = document.getElementById('theme-icon');

/** Apply a theme ('light' | 'dark') to document */
const applyTheme = (theme) => {
  if (theme === 'light') {
    document.body.classList.add('light');
    document.documentElement.classList.add('light-mode');
    themeIconEl.textContent = '☀️';
    themeToggleBtn.setAttribute('aria-label', 'Switch to dark mode');
  } else {
    document.body.classList.remove('light');
    document.documentElement.classList.remove('light-mode');
    themeIconEl.textContent = '🌙';
    themeToggleBtn.setAttribute('aria-label', 'Switch to light mode');
  }
};

/** Load saved theme and apply it */
const loadTheme = () => {
  const saved = lsGet(KEYS.THEME, 'dark');
  applyTheme(saved);
};

/** Toggle between light and dark themes */
const toggleTheme = () => {
  const isLight = document.body.classList.contains('light');
  const newTheme = isLight ? 'dark' : 'light';
  applyTheme(newTheme);
  lsSet(KEYS.THEME, newTheme);
};

themeToggleBtn.addEventListener('click', toggleTheme);

/* ============================================================
   Global keyboard accessibility — close modals with Escape
   ============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!modalName.classList.contains('hidden'))       closeNameModal();
  if (!modalLink.classList.contains('hidden'))       closeAddLinkModal();
  if (!modalTodoEdit.classList.contains('hidden'))   closeEditTaskModal();
});

/* ============================================================
   Initialisation — run on DOMContentLoaded
   ============================================================ */
const init = () => {
  // Apply theme first to avoid flash (also handled inline in HTML head)
  loadTheme();

  // Clock (start immediately, then tick every second)
  updateClock();
  setInterval(updateClock, 1000);

  // Greeting name
  loadUsername();

  // Pomodoro timer
  loadTimerDuration();

  // Tasks
  loadTasks();

  // Links
  loadLinks();
};

// Kick off when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
