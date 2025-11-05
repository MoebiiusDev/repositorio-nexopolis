
const editor = CodeMirror(document.getElementById('editor'), {
    mode: 'lua',
    theme: 'dracula',
    lineNumbers: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: true
});

const folderList = document.getElementById('folderList');
const snippetName = document.getElementById('snippetName');
const saveBtn = document.getElementById('saveBtn');
const renameBtn = document.getElementById('renameBtn');
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const deleteBtn = document.getElementById('deleteBtn');
const newBtn = document.getElementById('newBtn');
const newFolderBtn = document.getElementById('newFolderBtn');

let currentFolder = "Sin categoría";
let currentSnippet = null;

// 🔹 Obtener estructura
function getData() {
    return JSON.parse(localStorage.getItem("snippetsData") || "{}");
}
function saveData(data) {
    localStorage.setItem("snippetsData", JSON.stringify(data));
}
function ensureFolderExists(data, name) {
    if (!data[name]) data[name] = {};
}

// 🔹 Migrar snippets antiguos (versión anterior sin carpetas)
function migrateOldSnippets() {
    const data = getData();
    ensureFolderExists(data, "Sin categoría");

    for (const key in localStorage) {
        if (!localStorage.hasOwnProperty(key)) continue;
        if (key === "snippetsData") continue; // saltar estructura nueva

        const value = localStorage.getItem(key);
        if (typeof value === "string" && value.trim().length > 0) {
            data["Sin categoría"][key] = value;
            localStorage.removeItem(key);
            console.log(`✅ Migrado snippet antiguo: ${key}`);
        }
    }

    saveData(data);
}

// 🔹 Renderizar panel
function renderFolders() {
    const data = getData();
    folderList.innerHTML = "";

    // 🔸 Ordenar carpetas alfabéticamente
    const sortedFolders = Object.keys(data).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    sortedFolders.forEach(folderName => {
        const folderDiv = document.createElement("div");
        folderDiv.className = "folder";

        const header = document.createElement("div");
        header.className = "folder-header";

        // 🔸 Título de carpeta
        const titleSpan = document.createElement("span");
        titleSpan.textContent = folderName;
        titleSpan.onclick = () => toggleFolder(folderDiv);

        // 🔸 Contenedor de botones (alineados)
        const folderBtnGroup = document.createElement("div");
        folderBtnGroup.style.display = "flex";
        folderBtnGroup.style.gap = "5px";

        // 🔸 Botón de renombrar carpeta
        const renameFolderBtn = document.createElement("button");
        renameFolderBtn.textContent = "바꾸다";
        renameFolderBtn.className = "folder-action-btn";
        renameFolderBtn.title = `Renombrar carpeta "${folderName}"`;
        renameFolderBtn.onclick = e => {
            e.stopPropagation();
            renameFolder(folderName);
        };

        // 🔸 Botón para borrar carpeta
        const deleteFolderBtn = document.createElement("button");
        deleteFolderBtn.textContent = "Ω";
        deleteFolderBtn.className = "folder-action-btn delete";
        deleteFolderBtn.title = `Eliminar carpeta "${folderName}"`;
        deleteFolderBtn.onclick = e => {
            e.stopPropagation();
            if (!confirm(`¿Borrar la carpeta "${folderName}" y todos sus snippets?`)) return;
            delete data[folderName];
            saveData(data);
            // Si borraste la carpeta activa, resetea currentFolder
            if (currentFolder === folderName) {
                currentFolder = "Sin categoría";
                ensureFolderExists(data, currentFolder);
            }
            renderFolders();
        };

        // Agregar botones al grupo
        folderBtnGroup.appendChild(renameFolderBtn);
        folderBtnGroup.appendChild(deleteFolderBtn);

        // Agregar a la cabecera
        header.appendChild(titleSpan);
        header.appendChild(folderBtnGroup);

        const snippetsDiv = document.createElement("div");
        snippetsDiv.className = "snippets";
        snippetsDiv.style.display = "block";

        Object.keys(data[folderName]).forEach(snippet => {
            const item = document.createElement("div");
            item.className = "snippet-item";
            item.textContent = snippet;

            item.draggable = true;
            item.ondragstart = e => {
                e.dataTransfer.setData("snippet", snippet);
                e.dataTransfer.setData("fromFolder", folderName);
                item.classList.add("dragging");
            };
            item.ondragend = () => item.classList.remove("dragging");

            item.onclick = () => {
                currentSnippet = snippet;
                currentFolder = folderName;
                snippetName.value = snippet;
                editor.setValue(data[folderName][snippet]);
            };

            snippetsDiv.appendChild(item);
        });

        folderDiv.ondragover = e => e.preventDefault();
        folderDiv.ondrop = e => {
            const snippet = e.dataTransfer.getData("snippet");
            const fromFolder = e.dataTransfer.getData("fromFolder");
            if (fromFolder === folderName) return;
            const code = data[fromFolder][snippet];
            delete data[fromFolder][snippet];
            ensureFolderExists(data, folderName);
            data[folderName][snippet] = code;
            saveData(data);
            renderFolders();
        };

        folderDiv.appendChild(header);
        folderDiv.appendChild(snippetsDiv);
        folderList.appendChild(folderDiv);
    });
}

// 🔹 Renombrar carpeta (una única implementación correcta)
function renameFolder(oldName) {
    const data = getData();
    const newName = prompt("Nuevo nombre para la carpeta:", oldName);
    if (!newName || newName.trim() === "" || newName === oldName) return;

    if (data[newName]) {
        alert("Ya existe una carpeta con ese nombre.");
        return;
    }

    // Mover los snippets
    data[newName] = data[oldName];
    delete data[oldName];

    // Si la carpeta renombrada era la actual, actualizar currentFolder
    if (currentFolder === oldName) currentFolder = newName;

    saveData(data);
    renderFolders();
}

function toggleFolder(folderDiv) {
    const snippets = folderDiv.querySelector(".snippets");
    snippets.style.display = snippets.style.display === "none" ? "block" : "none";
}

// 🔹 Crear carpeta
newFolderBtn.onclick = () => {
    const name = prompt("Nombre de la nueva carpeta:");
    if (!name) return;
    const data = getData();
    ensureFolderExists(data, name);
    saveData(data);
    renderFolders();
};

// 🔹 Guardar snippet
saveBtn.onclick = () => {
    const name = snippetName.value.trim();
    if (!name) return alert("Ponle un nombre al snippet");
    const code = editor.getValue();
    const data = getData();
    ensureFolderExists(data, currentFolder);
    data[currentFolder][name] = code;
    saveData(data);
    currentSnippet = name;
    renderFolders();
    alert("Snippet guardado ✅");
};

// 🔹 Renombrar snippet
renameBtn.onclick = () => {
    if (!currentSnippet) return alert("Selecciona un snippet primero");
    const newName = prompt("Nuevo nombre:", currentSnippet);
    if (!newName) return;
    const data = getData();
    data[currentFolder][newName] = data[currentFolder][currentSnippet];
    delete data[currentFolder][currentSnippet];
    saveData(data);
    currentSnippet = newName;
    snippetName.value = newName;
    renderFolders();
};

// 🔹 Borrar snippet
deleteBtn.onclick = () => {
    if (!currentSnippet) return alert("Selecciona un snippet");
    if (!confirm(`¿Borrar "${currentSnippet}"?`)) return;
    const data = getData();
    delete data[currentFolder][currentSnippet];
    saveData(data);
    editor.setValue("");
    snippetName.value = "";
    currentSnippet = null;
    renderFolders();
};

// 🔹 Nuevo snippet
newBtn.onclick = () => {
    snippetName.value = "";
    editor.setValue("");
    currentSnippet = null;
};

// 🔹 Atajos de teclado
document.addEventListener("keydown", e => {
    // Alt + N → Nuevo snippet
    if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newBtn.click();
    }

    // Ctrl + S / R / B → Guardar / Renombrar / Borrar
    if (e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === "s") { e.preventDefault(); saveBtn.click(); }
        if (key === "r") { e.preventDefault(); renameBtn.click(); }
        if (key === "b") { e.preventDefault(); deleteBtn.click(); }
    }
});

// 🔹 Inicialización

// 🔹 Exportar todos los snippets como JSON
exportBtn.onclick = () => {
    const data = getData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "snippets_backup.json";
    a.click();
    URL.revokeObjectURL(url);
    alert("Backup exportado correctamente ✅");
};

// 🔹 Importar JSON y fusionar con los datos actuales
importBtn.onclick = () => {
    importFile.click();
};

importFile.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    try {
        const importedData = JSON.parse(text);
        const currentData = getData();

        // Fusionar sin sobrescribir (si hay conflicto)
        for (const folder in importedData) {
            if (!currentData[folder]) currentData[folder] = {};
            for (const snippet in importedData[folder]) {
                if (!currentData[folder][snippet]) {
                    currentData[folder][snippet] = importedData[folder][snippet];
                } else {
                    const overwrite = confirm(`El snippet "${snippet}" ya existe en "${folder}". ¿Deseas reemplazarlo?`);
                    if (overwrite) {
                        currentData[folder][snippet] = importedData[folder][snippet];
                    }
                }
            }
        }

        saveData(currentData);
        renderFolders();
        alert("Datos importados correctamente ✅");
    } catch (err) {
        alert("Error al importar JSON: archivo inválido ❌");
        console.error(err);
    }

    e.target.value = ""; // limpiar input
};

migrateOldSnippets();
renderFolders();
