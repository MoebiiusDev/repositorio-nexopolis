/* ============================================================
   CONFIGURACIÓN Y PREFIJOS
============================================================ */

const REPONEX_PREFIX = 'reponex_';

/* ============================================================
   CONFIGURACIÓN DEL EDITOR
============================================================ */

const editor = CodeMirror(document.getElementById('editor'), {
    mode: 'lua',
    theme: 'dracula',
    lineNumbers: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: true
});

/* ============================================================
   ELEMENTOS DEL DOM
============================================================ */

const folderList = document.getElementById('folderList');
const searchInput = document.getElementById('searchInput');
const currentPathLabel = document.getElementById('currentPathLabel');
const saveBtn = document.getElementById('saveBtn');
const renameBtn = document.getElementById('renameBtn');
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const deleteBtn = document.getElementById('deleteBtn');
const newBtn = document.getElementById('newBtn');
const copyAllBtn = document.getElementById("copyAllBtn");
const newFolderBtn = document.getElementById('newFolderBtn');
const selectModeBtn = document.getElementById('selectModeBtn');

const bulkActionsBar = document.getElementById('bulkActionsBar');
const selectionCount = document.getElementById('selectionCount');
const bulkMoveBtn = document.getElementById('bulkMoveBtn');
const bulkExportBtn = document.getElementById('bulkExportBtn');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const bulkCancelBtn = document.getElementById('bulkCancelBtn');

let currentFolder = "Sin categoría";
let currentSnippet = null;

let draggedSnippet = null;
let draggedFromFolder = null;

let selectionMode = false;
let selectedItems = []; // [{ folder, snippet }]

/* ============================================================
   LOCALSTORAGE CON MIGRACIÓN AUTOMÁTICA
============================================================ */

function getData() {
    // PRIMERO: Intentar migrar datos antiguos si existen
    migrateOldData();

    // LUEGO: Devolver datos con prefijo nuevo
    return JSON.parse(localStorage.getItem(REPONEX_PREFIX + "snippetsData") || "{}");
}

function saveData(data) {
    localStorage.setItem(REPONEX_PREFIX + "snippetsData", JSON.stringify(data));
}

function ensureFolderExists(data, name) {
    if (!data[name]) data[name] = {};
}

function migrateOldData() {
    // Verificar si ya migramos antes
    if (localStorage.getItem(REPONEX_PREFIX + 'migrated')) {
        return; // Ya se migró, no hacer nada
    }

    const oldData = localStorage.getItem("snippetsData");

    if (oldData) {
        console.log("🔄 Migrando datos antiguos de Reponexopolis...");

        // Copiar datos antiguos a nueva ubicación
        localStorage.setItem(REPONEX_PREFIX + "snippetsData", oldData);

        // Mantener copia de seguridad de datos antiguos por seguridad
        localStorage.setItem(REPONEX_PREFIX + "backup_old_snippetsData", oldData);

        // Marcar como migrado
        localStorage.setItem(REPONEX_PREFIX + 'migrated', 'true');

        console.log("✅ Migración completada");

        // Mostrar notificación al usuario
        toast("Sistema actualizado - Datos migrados exitosamente ✔", "success");
    } else {
        // No hay datos antiguos, marcar como migrado igual
        localStorage.setItem(REPONEX_PREFIX + 'migrated', 'true');
    }
}

/* ============================================================
   MIGRACIÓN DE VERSIONES ANTIGUAS (SNIPPETS SUELTOS)
============================================================ */

function migrateOldSnippets() {
    const data = getData();
    ensureFolderExists(data, "Sin categoría");

    let migratedCount = 0;

    for (const key in localStorage) {
        if (!localStorage.hasOwnProperty(key)) continue;

        // IGNORAR todas las claves con prefijos de otros proyectos
        if (key.startsWith('arkemius_') || key.startsWith('reponex_')) continue;

        // Solo procesar claves que parecen ser snippets del proyecto antiguo
        // (excluyendo la clave principal que ya manejamos en migrateOldData)
        if (key !== "snippetsData" && typeof localStorage.getItem(key) === "string") {
            const value = localStorage.getItem(key);
            if (value && value.trim().length > 0) {
                data["Sin categoría"][key] = value;
                localStorage.removeItem(key);
                migratedCount++;
            }
        }
    }

    if (migratedCount > 0) {
        saveData(data);
        console.log(`✅ Migrados ${migratedCount} snippets antiguos`);
        toast(`Migrados ${migratedCount} snippets antiguos ✔`);
    }
}

/* ============================================================
   CARPETAS IMPORTANTES (ESTRELLA DORADA)
============================================================ */

function getImportantFolders() {
    return JSON.parse(localStorage.getItem(REPONEX_PREFIX + "importantFolders") || "[]");
}

function setImportantFolders(list) {
    localStorage.setItem(REPONEX_PREFIX + "importantFolders", JSON.stringify(list));
}

function toggleImportantFolder(folderName) {
    let important = getImportantFolders();
    if (important.includes(folderName)) {
        important = important.filter(f => f !== folderName);
    } else {
        important.push(folderName);
    }
    setImportantFolders(important);
}

/* ============================================================
   MODALES PERSONALIZADOS
============================================================ */

function customPrompt(title, message, defaultText = "") {
    return new Promise(resolve => {
        const overlay = document.getElementById("modal-overlay");
        const titleEl = document.getElementById("modal-title");
        const msgEl = document.getElementById("modal-message");
        const input = document.getElementById("modal-input");
        const folderSelect = document.getElementById("modal-folder-select");
        const cancel = document.getElementById("modal-cancel");
        const ok = document.getElementById("modal-ok");

        titleEl.textContent = title;
        msgEl.textContent = message;

        input.value = defaultText;
        input.classList.remove("hidden");
        folderSelect.classList.add("hidden");

        overlay.classList.remove("hidden");
        input.focus();

        cancel.onclick = () => {
            overlay.classList.add("hidden");
            resolve(null);
        };

        ok.onclick = () => {
            overlay.classList.add("hidden");
            resolve(input.value.trim());
        };
    });
}

function customConfirm(message) {
    return new Promise(resolve => {
        const overlay = document.getElementById("modal-overlay");
        const titleEl = document.getElementById("modal-title");
        const msgEl = document.getElementById("modal-message");
        const input = document.getElementById("modal-input");
        const folderSelect = document.getElementById("modal-folder-select");
        const cancel = document.getElementById("modal-cancel");
        const ok = document.getElementById("modal-ok");

        titleEl.textContent = "Confirmar";
        msgEl.textContent = message;

        // ❗ Ocultar el input y el select a la fuerza
        input.classList.add("hidden");
        folderSelect.classList.add("hidden");

        // Colores para confirmar
        ok.style.background = "#9cfed5";
        ok.style.color = "black";
        cancel.style.background = "#ff8888";
        cancel.style.color = "black";

        overlay.classList.remove("hidden");

        cancel.onclick = () => {
            overlay.classList.add("hidden");
            resolve(false);
        };

        ok.onclick = () => {
            overlay.classList.add("hidden");
            resolve(true);
        };
    });
}

/* ============================================================
   MODAL DE NUEVO SNIPPET (CON SELECTOR DE CARPETA DESTINO)
============================================================ */

function customPromptNewSnippet(folderNames, defaultFolder) {
    return new Promise(resolve => {
        const overlay = document.getElementById("modal-overlay");
        const titleEl = document.getElementById("modal-title");
        const msgEl = document.getElementById("modal-message");
        const input = document.getElementById("modal-input");
        const folderSelect = document.getElementById("modal-folder-select");
        const cancel = document.getElementById("modal-cancel");
        const ok = document.getElementById("modal-ok");

        titleEl.textContent = "Nuevo Snippet";
        msgEl.textContent = "Nombre del snippet y carpeta destino:";

        input.value = "";
        input.placeholder = "Nombre del snippet";
        input.classList.remove("hidden");

        folderSelect.innerHTML = "";
        folderNames.forEach(folder => {
            const opt = document.createElement("option");
            opt.value = folder;
            opt.textContent = folder;
            if (folder === defaultFolder) opt.selected = true;
            folderSelect.appendChild(opt);
        });
        folderSelect.classList.remove("hidden");

        overlay.classList.remove("hidden");
        input.focus();

        const close = () => {
            overlay.classList.add("hidden");
            input.placeholder = "";
            folderSelect.classList.add("hidden");
        };

        cancel.onclick = () => {
            close();
            resolve(null);
        };

        ok.onclick = () => {
            const name = input.value.trim();
            const folder = folderSelect.value || defaultFolder;
            close();
            resolve(name ? { name, folder } : null);
        };
    });
}

/* ============================================================
   TOASTS
============================================================ */

function toast(message, type = "success") {
    const container = document.getElementById("toast-container");

    const toastEl = document.createElement("div");
    toastEl.className = `toast ${type}`;
    toastEl.textContent = message;

    container.appendChild(toastEl);

    setTimeout(() => {
        toastEl.style.animation = "fadeOutToast 0.4s forwards";
        setTimeout(() => toastEl.remove(), 400);
    }, 3000);
}

/* ============================================================
   RUTA ACTUAL (reemplaza el antiguo uso del input snippetName)
============================================================ */

function updateCurrentPathLabel() {
    if (currentSnippet) {
        currentPathLabel.textContent = `📄 ${currentFolder} / ${currentSnippet}`;
    } else {
        currentPathLabel.textContent = "";
    }
}

/* ============================================================
   MODO SELECCIÓN MÚLTIPLE
============================================================ */

function toggleSelectionMode() {
    selectionMode = !selectionMode;
    selectModeBtn.classList.toggle('active', selectionMode);
    selectModeBtn.textContent = selectionMode ? "☑ Cancelar selección" : "☑ Seleccionar";

    if (!selectionMode) {
        selectedItems = [];
    }

    updateBulkBar();
    renderFolders();
}

function exitSelectionMode() {
    selectionMode = false;
    selectedItems = [];
    selectModeBtn.classList.remove('active');
    selectModeBtn.textContent = "☑ Seleccionar";
    updateBulkBar();
}

function updateBulkBar() {
    if (selectionMode) {
        bulkActionsBar.classList.remove('hidden');
        selectionCount.textContent = `${selectedItems.length} seleccionados`;
    } else {
        bulkActionsBar.classList.add('hidden');
    }
}

function isSelected(folder, snippet) {
    return selectedItems.some(s => s.folder === folder && s.snippet === snippet);
}

function toggleSelection(folder, snippet, itemEl) {
    const idx = selectedItems.findIndex(s => s.folder === folder && s.snippet === snippet);
    if (idx >= 0) {
        selectedItems.splice(idx, 1);
        itemEl.classList.remove('selected');
    } else {
        selectedItems.push({ folder, snippet });
        itemEl.classList.add('selected');
    }
    updateBulkBar();
}

/* ============================================================
   BUSCADOR DE SNIPPETS / CARPETAS
============================================================ */

function applySearchFilter() {
    const query = searchInput.value.trim().toLowerCase();
    const folderDivs = folderList.querySelectorAll('.folder');

    folderDivs.forEach(folderDiv => {
        const folderNameEl = folderDiv.querySelector('.folder-title');
        const folderNameText = folderNameEl ? folderNameEl.textContent.toLowerCase() : "";
        const snippetItems = folderDiv.querySelectorAll('.snippet-item');

        let anySnippetMatch = false;

        snippetItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            const matches = query !== "" && text.includes(query);
            item.classList.toggle('search-match', matches);
            if (matches) anySnippetMatch = true;
        });

        const folderNameMatches = query !== "" && folderNameText.includes(query);
        const show = query === "" || folderNameMatches || anySnippetMatch;

        folderDiv.style.display = show ? "" : "none";

        if (query !== "" && anySnippetMatch) {
            const snippetsDiv = folderDiv.querySelector('.snippets');
            if (snippetsDiv) snippetsDiv.style.display = "block";
        }
    });
}

searchInput.addEventListener('input', applySearchFilter);

/* ============================================================
   CARPETAS Y SNIPPETS
============================================================ */

function toggleFolder(folderDiv) {
    const snippets = folderDiv.querySelector(".snippets");
    snippets.style.display = snippets.style.display === "none" ? "block" : "none";
}

function renderFolders() {
    const data = getData();
    const importantFolders = getImportantFolders();
    folderList.innerHTML = "";

    const sortedFolders = Object.keys(data).sort((a, b) => {
        const aImp = importantFolders.includes(a);
        const bImp = importantFolders.includes(b);
        if (aImp && !bImp) return -1;
        if (!aImp && bImp) return 1;
        return a.localeCompare(b, 'es', { sensitivity: 'base' });
    });

    sortedFolders.forEach(folderName => {
        const isImportant = importantFolders.includes(folderName);

        const folderDiv = document.createElement("div");
        folderDiv.className = "folder" + (isImportant ? " important" : "");

        const header = document.createElement("div");
        header.className = "folder-header";

        const titleSpan = document.createElement("span");
        titleSpan.className = "folder-title";
        titleSpan.textContent = folderName;
        titleSpan.onclick = () => toggleFolder(folderDiv);

        const folderBtnGroup = document.createElement("div");
        folderBtnGroup.style.display = "flex";
        folderBtnGroup.style.gap = "5px";

        // Marcar como importante → estrella dorada
        const starBtn = document.createElement("button");
        starBtn.textContent = isImportant ? "⭐" : "☆";
        starBtn.title = isImportant ? "Quitar de importantes" : "Marcar como importante";
        starBtn.className = "folder-action-btn star" + (isImportant ? " active" : "");
        starBtn.onclick = e => {
            e.stopPropagation();
            toggleImportantFolder(folderName);
            renderFolders();
        };

        // Renombrar carpeta → usa customPrompt
        const renameFolderBtn = document.createElement("button");
        renameFolderBtn.textContent = "𝘳𝘦𝘯𝘢𝘮𝘦";
        renameFolderBtn.className = "folder-action-btn";
        renameFolderBtn.onclick = async e => {
            e.stopPropagation();
            renameFolder(folderName);
        };

        // Borrar carpeta → customConfirm
        const deleteFolderBtn = document.createElement("button");
        deleteFolderBtn.textContent = "𝘥𝘦𝘭𝘦𝘵𝘦";
        deleteFolderBtn.title = "Eliminar carpeta";
        deleteFolderBtn.className = "folder-action-btn delete";
        deleteFolderBtn.onclick = async e => {
            e.stopPropagation();

            const ok = await customConfirm(
                `¿Eliminar la carpeta "${folderName}" y todos sus snippets?`
            );
            if (!ok) return;

            delete data[folderName];
            saveData(data);

            if (currentFolder === folderName) {
                currentFolder = "Sin categoría";
                ensureFolderExists(data, currentFolder);
            }

            renderFolders();
        };

        folderBtnGroup.appendChild(starBtn);
        folderBtnGroup.appendChild(renameFolderBtn);
        folderBtnGroup.appendChild(deleteFolderBtn);

        header.appendChild(titleSpan);
        header.appendChild(folderBtnGroup);

        // 🟩 HABILITAR DROP DE SNIPPETS EN ESTA CARPETA
        enableFolderDrop(header, folderName);

        const snippetsDiv = document.createElement("div");
        snippetsDiv.className = "snippets";

        Object.keys(data[folderName]).forEach(snippet => {
            const item = document.createElement("div");
            item.className = "snippet-item";
            item.textContent = snippet;

            if (selectionMode && isSelected(folderName, snippet)) {
                item.classList.add('selected');
            }

            item.onclick = () => {
                if (selectionMode) {
                    toggleSelection(folderName, snippet, item);
                    return;
                }
                currentSnippet = snippet;
                currentFolder = folderName;
                updateCurrentPathLabel();
                editor.setValue(data[folderName][snippet]);
            };

            // 🟦 HABILITAR DRAG DEL SNIPPET
            enableSnippetDrag(item, folderName, snippet);

            snippetsDiv.appendChild(item);
        });

        folderDiv.appendChild(header);
        folderDiv.appendChild(snippetsDiv);
        folderList.appendChild(folderDiv);
    });

    applySearchFilter();
}

/* ============================================================
   RENOMBRAR CARPETA (CON MODAL)
============================================================ */

async function renameFolder(oldName) {
    const data = getData();

    const newName = await customPrompt("Renombrar carpeta", "Nuevo nombre:", oldName);
    if (!newName || newName.trim() === "" || newName === oldName) return;

    if (data[newName]) {
        toast("Ya existe una carpeta con ese nombre.");
        return;
    }

    data[newName] = data[oldName];
    delete data[oldName];

    // Mantener marca de "importante" si la carpeta la tenía
    const important = getImportantFolders();
    const idx = important.indexOf(oldName);
    if (idx >= 0) {
        important[idx] = newName;
        setImportantFolders(important);
    }

    if (currentFolder === oldName) currentFolder = newName;

    saveData(data);
    renderFolders();
}

/* ============================================================
   ACCIONES DE BOTONES
============================================================ */

// Crear carpeta
newFolderBtn.onclick = async () => {
    const name = await customPrompt("Nueva carpeta", "Nombre:");
    if (!name) return;

    const data = getData();
    ensureFolderExists(data, name);
    saveData(data);
    renderFolders();
};

// Guardar snippet (usa el snippet actualmente abierto, ya no un input de nombre)
saveBtn.onclick = () => {
    if (!currentSnippet) {
        return toast("Crea o abre un snippet primero (botón 'Nuevo') ❗", "error");
    }

    const code = editor.getValue();
    const data = getData();

    ensureFolderExists(data, currentFolder);
    data[currentFolder][currentSnippet] = code;

    saveData(data);
    renderFolders();
    toast("Snippet guardado ✔");
};

// Renombrar snippet
renameBtn.onclick = async () => {
    if (!currentSnippet) return toast("Selecciona un snippet primero");

    const newName = await customPrompt("Renombrar snippet", "Nuevo nombre:", currentSnippet);
    if (!newName) return;

    const data = getData();

    data[currentFolder][newName] = data[currentFolder][currentSnippet];
    delete data[currentFolder][currentSnippet];

    saveData(data);

    currentSnippet = newName;
    updateCurrentPathLabel();

    renderFolders();
};

// Borrar snippet
deleteBtn.onclick = async () => {
    if (!currentSnippet) return toast("Selecciona un snippet");

    const ok = await customConfirm(`¿Borrar "${currentSnippet}"?`);
    if (!ok) return;

    const data = getData();
    delete data[currentFolder][currentSnippet];

    saveData(data);

    editor.setValue("");
    currentSnippet = null;
    updateCurrentPathLabel();

    renderFolders();
};

// Nuevo snippet
newBtn.onclick = async () => {
    const data = getData();
    ensureFolderExists(data, "Sin categoría");

    const folderNames = Object.keys(data).sort((a, b) =>
        a.localeCompare(b, 'es', { sensitivity: 'base' })
    );

    const result = await customPromptNewSnippet(folderNames, "Sin categoría");
    if (!result) {
        toast("Debes ingresar un nombre para crear un snippet ❗", "error");
        return;
    }

    const { name, folder } = result;

    ensureFolderExists(data, folder);
    data[folder][name] = "";
    saveData(data);

    // La carpeta destino elegida en el modal pasa a ser la carpeta activa,
    // sin importar qué snippet estuviera abierto antes.
    currentFolder = folder;
    currentSnippet = name;
    editor.setValue("");
    updateCurrentPathLabel();

    renderFolders();
};

// Copiar todo
copyAllBtn.onclick = () => {
    navigator.clipboard.writeText(editor.getValue())
        .then(() => toast("Código copiado ✔"))
        .catch(() => toast("Error al copiar ❌"));
};

// Modo selección múltiple
selectModeBtn.onclick = toggleSelectionMode;

/* ============================================================
   ACCIONES EN LOTE (MODO SELECCIÓN)
============================================================ */

bulkMoveBtn.onclick = async () => {
    if (selectedItems.length === 0) return toast("No hay snippets seleccionados", "error");

    const data = getData();
    const folderNames = Object.keys(data).sort((a, b) =>
        a.localeCompare(b, 'es', { sensitivity: 'base' })
    );

    const dest = await customPrompt(
        "Mover selección",
        `Carpetas disponibles: ${folderNames.join(", ")}. Escribe el nombre destino (puede ser una nueva):`
    );
    if (!dest) return;

    ensureFolderExists(data, dest);

    let movedCount = 0;
    selectedItems.forEach(({ folder, snippet }) => {
        if (folder === dest) return;
        if (!data[folder] || !Object.prototype.hasOwnProperty.call(data[folder], snippet)) return;

        data[dest][snippet] = data[folder][snippet];
        delete data[folder][snippet];
        movedCount++;
    });

    saveData(data);
    exitSelectionMode();
    renderFolders();
    toast(`${movedCount} snippet(s) movidos a "${dest}" ✔`);
};

bulkExportBtn.onclick = () => {
    if (selectedItems.length === 0) return toast("No hay snippets seleccionados", "error");

    const data = getData();
    const exportData = {};

    selectedItems.forEach(({ folder, snippet }) => {
        if (!data[folder] || !Object.prototype.hasOwnProperty.call(data[folder], snippet)) return;
        if (!exportData[folder]) exportData[folder] = {};
        exportData[folder][snippet] = data[folder][snippet];
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "snippets_seleccionados.json";
    a.click();

    URL.revokeObjectURL(url);
    toast("Selección exportada ✔");
};

bulkDeleteBtn.onclick = async () => {
    if (selectedItems.length === 0) return toast("No hay snippets seleccionados", "error");

    const ok = await customConfirm(`¿Eliminar ${selectedItems.length} snippet(s) seleccionados?`);
    if (!ok) return;

    const data = getData();
    let clearedCurrent = false;

    selectedItems.forEach(({ folder, snippet }) => {
        if (data[folder]) delete data[folder][snippet];
        if (folder === currentFolder && snippet === currentSnippet) clearedCurrent = true;
    });

    saveData(data);

    if (clearedCurrent) {
        currentSnippet = null;
        editor.setValue("");
        updateCurrentPathLabel();
    }

    exitSelectionMode();
    renderFolders();
    toast("Snippets eliminados ✔");
};

bulkCancelBtn.onclick = () => {
    exitSelectionMode();
    renderFolders();
};

/* ============================================================
   ATAJOS DE TECLADO
============================================================ */

document.addEventListener("keydown", e => {
    if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newBtn.click();
    }

    if (e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === "s") { e.preventDefault(); saveBtn.click(); }
        if (key === "r") { e.preventDefault(); renameBtn.click(); }
        if (key === "b") { e.preventDefault(); deleteBtn.click(); }
        if (key === "a") { e.preventDefault(); copyAllBtn.click(); }
    }
});

/* ============================================================
   IMPORTAR / EXPORTAR JSON
============================================================ */

exportBtn.onclick = () => {
    const data = getData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "snippets_backup.json";
    a.click();

    URL.revokeObjectURL(url);
    toast("Backup exportado ✔");
};

importBtn.onclick = () => importFile.click();

importFile.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();

    try {
        const importedData = JSON.parse(text);
        const currentData = getData();

        for (const folder in importedData) {
            if (!currentData[folder]) currentData[folder] = {};

            for (const snippet in importedData[folder]) {
                if (!currentData[folder][snippet]) {
                    currentData[folder][snippet] = importedData[folder][snippet];
                } else {
                    const ok = await customConfirm(
                        `El snippet "${snippet}" ya existe en "${folder}". ¿Reemplazarlo?`
                    );
                    if (ok) {
                        currentData[folder][snippet] = importedData[folder][snippet];
                    }
                }
            }
        }

        saveData(currentData);
        renderFolders();
        toast("Datos importados ✔");

    } catch (err) {
        toast("Error al importar ❌");
    }

    e.target.value = "";
};

/* ============================================================
   DRAG & DROP DE SNIPPETS ENTRE CARPETAS
============================================================ */

function enableSnippetDrag(item, folderName, snippetName) {
    item.draggable = true;

    item.addEventListener("dragstart", e => {
        draggedSnippet = snippetName;
        draggedFromFolder = folderName;
        e.dataTransfer.effectAllowed = "move";
        item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
        draggedSnippet = null;
        draggedFromFolder = null;
        item.classList.remove("dragging");
    });
}

function enableFolderDrop(folderHeader, folderName) {
    folderHeader.addEventListener("dragover", e => {
        if (draggedSnippet) e.preventDefault();
    });

    folderHeader.addEventListener("drop", e => {
        e.preventDefault();
        if (!draggedSnippet || !draggedFromFolder) return;

        const data = getData();

        if (!data[draggedFromFolder] || !Object.prototype.hasOwnProperty.call(data[draggedFromFolder], draggedSnippet)) return;

        // Si se suelta dentro de la misma carpeta, ignorar
        if (draggedFromFolder === folderName) return;

        // Mover snippet
        ensureFolderExists(data, folderName);
        data[folderName][draggedSnippet] = data[draggedFromFolder][draggedSnippet];
        delete data[draggedFromFolder][draggedSnippet];

        saveData(data);
        renderFolders();

        toast(`"${draggedSnippet}" movido a "${folderName}" ✔`);
    });
}

/* ============================================================
   INICIALIZACIÓN
============================================================ */

migrateOldSnippets();
renderFolders();

// Verificación en consola
console.log("🚀 Reponexopolis iniciado con prefijo:", REPONEX_PREFIX);
console.log("📊 Claves en localStorage:", Object.keys(localStorage).filter(key => key.startsWith(REPONEX_PREFIX)));