const LS_KEY_V2 = "todo-advanced:v2";
const LS_KEY_OLD = "todo-advanced:v1";
const THEME_KEY = "todo-advanced:theme";

const form = document.getElementById("form");
const input = document.getElementById("newTodo");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");

const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort");

const priorityEl = document.getElementById("priority");
const dueEl = document.getElementById("due");

const chipTotal = document.getElementById("chipTotal");
const chipActive = document.getElementById("chipActive");
const chipDone = document.getElementById("chipDone");

const clearDoneBtn = document.getElementById("clearDone");
const resetAllBtn = document.getElementById("resetAll");
const themeToggle = document.getElementById("themeToggle");

let state = {
  todos: loadTodosNormalized(),
  filter: "all",
  search: "",
  sort: "manual"
};

function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/* -------- LocalStorage + Normalization -------- */
function loadAny(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  }catch{
    return null;
  }
}

// Eski kayıtlar (v1/v2) karışsa bile done alanını garanti boolean yap.
function normalizeTodo(t){
  const doneBool = (typeof t.done === "boolean") ? t.done : (t.done === "true" || t.done === 1);

  const pr = (t.priority === "high" || t.priority === "med" || t.priority === "low") ? t.priority : "med";
  const due = (typeof t.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due)) ? t.due : null;

  return {
    id: String(t.id || uid()),
    text: String(t.text || "").trim(),
    done: doneBool,
    createdAt: Number(t.createdAt || Date.now()),
    priority: pr,
    due: due
  };
}

function loadTodosNormalized(){
  const v2 = loadAny(LS_KEY_V2);
  const v1 = loadAny(LS_KEY_OLD);

  const base = (v2 && v2.length) ? v2 : (v1 && v1.length ? v1 : []);
  const normalized = base
    .map(normalizeTodo)
    .filter(t => t.text.length > 0);

  // normalize edip v2’ye yaz (bir kere düzelsin)
  localStorage.setItem(LS_KEY_V2, JSON.stringify(normalized));
  return normalized;
}

function saveTodos(){
  localStorage.setItem(LS_KEY_V2, JSON.stringify(state.todos));
}

/* -------- Stats -------- */
function setStats(){
  const total = state.todos.length;
  const done = state.todos.filter(t => t.done === true).length;
  const active = total - done;
  chipTotal.textContent = total;
  chipActive.textContent = active;
  chipDone.textContent = done;
}

/* -------- Helpers -------- */
function priorityRank(p){
  if(p === "high") return 3;
  if(p === "med") return 2;
  return 1;
}

function isOverdue(todo){
  if(!todo.due || todo.done) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  const due = new Date(todo.due + "T00:00:00");
  return due < today;
}

function formatDue(due){
  if(!due) return "";
  const [y,m,d] = due.split("-");
  return `${d}.${m}.${y}`;
}

/* -------- View -------- */
function applyView(){
  let items = [...state.todos];

  // filter
  if(state.filter === "active") items = items.filter(t => t.done === false);
  if(state.filter === "done") items = items.filter(t => t.done === true);

  // search
  const q = state.search.trim().toLowerCase();
  if(q) items = items.filter(t => t.text.toLowerCase().includes(q));

  // sort
  if(state.sort === "newest") items.sort((a,b) => b.createdAt - a.createdAt);
  if(state.sort === "oldest") items.sort((a,b) => a.createdAt - b.createdAt);
  if(state.sort === "az") items.sort((a,b) => a.text.localeCompare(b.text));
  if(state.sort === "za") items.sort((a,b) => b.text.localeCompare(a.text));

  if(state.sort === "priority"){
    items.sort((a,b) => priorityRank(b.priority) - priorityRank(a.priority));
  }

  if(state.sort === "due"){
    items.sort((a,b) => {
      const ad = a.due ? new Date(a.due+"T00:00:00").getTime() : Number.POSITIVE_INFINITY;
      const bd = b.due ? new Date(b.due+"T00:00:00").getTime() : Number.POSITIVE_INFINITY;
      return ad - bd;
    });
  }

  render(items);
  setStats();

  emptyEl.classList.toggle("hidden", state.todos.length !== 0);
}

function render(items){
  listEl.innerHTML = "";

  for(const t of items){
    const li = document.createElement("li");
    li.className = "item" + (t.done ? " done" : "");
    li.dataset.id = t.id;
    li.draggable = (state.sort === "manual");

    const left = document.createElement("div");
    left.className = "leftRow";

    const drag = document.createElement("div");
    drag.className = "drag";
    drag.title = "Sürükle";
    drag.textContent = "⋮⋮";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "check";
    chk.checked = (t.done === true);
    chk.addEventListener("change", () => toggleDone(t.id));

    const text = document.createElement("div");
    text.className = "text";
    text.textContent = t.text;
    text.title = t.text;

    const meta = document.createElement("div");
    meta.className = "meta";

    const pr = document.createElement("span");
    pr.className = `badge ${t.priority}`;
    pr.textContent = t.priority.toUpperCase();

    const due = document.createElement("span");
    const overdue = isOverdue(t);
    due.className = "badge" + (overdue ? " overdue" : "");
    due.textContent = t.due
      ? (overdue ? `GEÇTİ: ${formatDue(t.due)}` : `Due: ${formatDue(t.due)}`)
      : "No due";

    meta.appendChild(pr);
    meta.appendChild(due);

    left.appendChild(drag);
    left.appendChild(chk);
    left.appendChild(text);
    left.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.className = "iconBtn";
    editBtn.type = "button";
    editBtn.textContent = "Düzenle";
    editBtn.addEventListener("click", () => startEdit(t.id, text, actions));

    const delBtn = document.createElement("button");
    delBtn.className = "iconBtn";
    delBtn.type = "button";
    delBtn.textContent = "Sil";
    delBtn.addEventListener("click", () => removeTodo(t.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(actions);

    li.addEventListener("dragstart", onDragStart);
    li.addEventListener("dragend", onDragEnd);
    li.addEventListener("dragover", onDragOver);
    li.addEventListener("drop", onDrop);

    listEl.appendChild(li);
  }
}

/* -------- CRUD -------- */
function addTodo(text){
  const v = text.trim();
  if(!v) return;

  const pr = priorityEl.value || "med";
  const due = dueEl.value ? dueEl.value : null;

  state.todos.unshift({
    id: uid(),
    text: v,
    done: false,
    createdAt: Date.now(),
    priority: pr,
    due: due
  });

  saveTodos();
  applyView();
}

function toggleDone(id){
  const t = state.todos.find(x => x.id === id);
  if(!t) return;

  t.done = !t.done;   // boolean garanti
  saveTodos();
  applyView();
}

function removeTodo(id){
  state.todos = state.todos.filter(x => x.id !== id);
  saveTodos();
  applyView();
}

function startEdit(id, textEl, actionsEl){
  const t = state.todos.find(x => x.id === id);
  if(!t) return;

  const edit = document.createElement("input");
  edit.className = "editInput";
  edit.value = t.text;

  const saveBtn = document.createElement("button");
  saveBtn.className = "iconBtn";
  saveBtn.type = "button";
  saveBtn.textContent = "Kaydet";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "iconBtn";
  cancelBtn.type = "button";
  cancelBtn.textContent = "Vazgeç";

  const commit = () => {
    const v = edit.value.trim();
    if(!v) return;
    t.text = v;
    saveTodos();
    applyView();
  };

  saveBtn.addEventListener("click", commit);
  cancelBtn.addEventListener("click", applyView);

  edit.addEventListener("keydown", (e) => {
    if(e.key === "Enter") commit();
    if(e.key === "Escape") applyView();
  });

  textEl.replaceWith(edit);
  actionsEl.innerHTML = "";
  actionsEl.appendChild(saveBtn);
  actionsEl.appendChild(cancelBtn);

  edit.focus();
  edit.select();
}

/* -------- Drag & Drop (manual) -------- */
let dragId = null;

function onDragStart(e){
  if(state.sort !== "manual") return;
  dragId = this.dataset.id;
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}
function onDragEnd(){
  this.classList.remove("dragging");
  dragId = null;
}
function onDragOver(e){
  if(state.sort !== "manual") return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}
function onDrop(e){
  if(state.sort !== "manual") return;
  e.preventDefault();

  const targetId = this.dataset.id;
  if(!dragId || dragId === targetId) return;

  const from = state.todos.findIndex(t => t.id === dragId);
  const to = state.todos.findIndex(t => t.id === targetId);
  if(from < 0 || to < 0) return;

  const [moved] = state.todos.splice(from, 1);
  state.todos.splice(to, 0, moved);

  saveTodos();
  applyView();
}

/* -------- Theme -------- */
function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.textContent = theme === "dark" ? "Light" : "Dark";
}
function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === "dark" ? "dark" : "light");
}

/* -------- Events -------- */
form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo(input.value);
  input.value = "";
  dueEl.value = "";
  priorityEl.value = "med";
});

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.filter = btn.dataset.filter; // all|active|done
    applyView();
  });
});

searchEl.addEventListener("input", () => {
  state.search = searchEl.value;
  applyView();
});

sortEl.addEventListener("change", () => {
  state.sort = sortEl.value;
  applyView();
});

clearDoneBtn.addEventListener("click", () => {
  state.todos = state.todos.filter(t => t.done === false);
  saveTodos();
  applyView();
});

resetAllBtn.addEventListener("click", () => {
  state.todos = [];
  saveTodos();
  applyView();
});

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

/* init */
initTheme();
applyView();
