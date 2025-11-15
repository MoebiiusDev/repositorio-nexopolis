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
const snippetName = document.getElementById('snippetName');
const saveBtn = document.getElementById('saveBtn');
const renameBtn = document.getElementById('renameBtn');
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const deleteBtn = document.getElementById('deleteBtn');
const newBtn = document.getElementById('newBtn');
const copyAllBtn = document.getElementById("copyAllBtn");
const newFolderBtn = document.getElementById('newFolderBtn');

let currentFolder = "Sin categoría";
let currentSnippet = null;

let draggedSnippet = null;
let draggedFromFolder = null;


/* ============================================================
   MODALES PERSONALIZADOS
============================================================ */

function customPrompt(title, message, defaultText = "") {
    return new Promise(resolve => {
        const overlay = document.getElementById("modal-overlay");
        const titleEl = document.getElementById("modal-title");
        const msgEl = document.getElementById("modal-message");
        const input = document.getElementById("modal-input");
        const cancel = document.getElementById("modal-cancel");
        const ok = document.getElementById("modal-ok");

        titleEl.textContent = title;
        msgEl.textContent = message;

        input.value = defaultText;
        input.classList.remove("hidden");

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
        const cancel = document.getElementById("modal-cancel");
        const ok = document.getElementById("modal-ok");

        titleEl.textContent = "Confirmar";
        msgEl.textContent = message;

        // ❗ Ocultar el input a la fuerza
        input.classList.add("hidden");

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
   LOCALSTORAGE
============================================================ */

function getData() {
    return JSON.parse(localStorage.getItem("snippetsData") || "{}");
}

function saveData(data) {
    localStorage.setItem("snippetsData", JSON.stringify(data));
}

function ensureFolderExists(data, name) {
    if (!data[name]) data[name] = {};
}

/* ============================================================
   MIGRACIÓN DE VERSIONES ANTIGUAS
============================================================ */

function migrateOldSnippets() {
    const data = getData();
    ensureFolderExists(data, "Sin categoría");

    for (const key in localStorage) {
        if (!localStorage.hasOwnProperty(key)) continue;
        if (key === "snippetsData") continue;

        const value = localStorage.getItem(key);
        if (typeof value === "string" && value.trim().length > 0) {
            data["Sin categoría"][key] = value;
            localStorage.removeItem(key);
        }
    }

    saveData(data);
}

/* ============================================================
   TOASTS
============================================================ */

function toast(message, type = "success") {
    const container = document.getElementById("toast-container");

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "fadeOutToast 0.4s forwards";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

/* ============================================================
   CARPETAS Y SNIPPETS
============================================================ */

function toggleFolder(folderDiv) {
    const snippets = folderDiv.querySelector(".snippets");
    snippets.style.display = snippets.style.display === "none" ? "block" : "none";
}


function renderFolders() {
    const data = getData();
    folderList.innerHTML = "";

    const sortedFolders = Object.keys(data).sort((a, b) =>
        a.localeCompare(b, 'es', { sensitivity: 'base' })
    );

    sortedFolders.forEach(folderName => {
        const folderDiv = document.createElement("div");
        folderDiv.className = "folder";

        const header = document.createElement("div");
        header.className = "folder-header";

        const titleSpan = document.createElement("span");
        titleSpan.textContent = folderName;
        titleSpan.onclick = () => toggleFolder(folderDiv);

        const folderBtnGroup = document.createElement("div");
        folderBtnGroup.style.display = "flex";
        folderBtnGroup.style.gap = "5px";

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
        deleteFolderBtn.textContent = "Ω";
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

            item.onclick = () => {
                currentSnippet = snippet;
                currentFolder = folderName;
                snippetName.value = snippet;
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

// Guardar snippet
saveBtn.onclick = () => {
    const name = snippetName.value.trim();
    if (!name) return toast("Ponle un nombre al snippet");

    const code = editor.getValue();
    const data = getData();

    ensureFolderExists(data, currentFolder);
    data[currentFolder][name] = code;

    saveData(data);
    currentSnippet = name;
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
    snippetName.value = newName;

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
    snippetName.value = "";
    currentSnippet = null;

    renderFolders();
};

// Nuevo snippet
newBtn.onclick = async () => {
    const name = await customPrompt("Nuevo Snippet", "Ingresa el nombre del snippet:");
    if (!name) {
        toast("Debes ingresar un nombre para crear un snippet ❗", "error");
        return;
    }

    const data = getData();
    ensureFolderExists(data, currentFolder);

    data[currentFolder][name] = "";
    saveData(data);

    currentSnippet = name;
    snippetName.value = name;
    editor.setValue("");

    renderFolders();
};


// Copiar todo
copyAllBtn.onclick = () => {
    navigator.clipboard.writeText(editor.getValue())
        .then(() => toast("Código copiado ✔"))
        .catch(() => toast("Error al copiar ❌"));
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

        if (!data[draggedFromFolder] || !data[draggedFromFolder][draggedSnippet]) return;

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
