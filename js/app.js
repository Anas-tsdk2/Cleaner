
// Configuration du mode debug
const DEBUG = true; // À mettre à false en production
const VALID_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB en bytes
const ERROR_MESSAGES = {
    invalidType: 'Format de fichier invalide. Veuillez sélectionner un fichier CSV.',
    tooLarge: 'Fichier trop volumineux. La taille maximum est de 5MB.',
    noFile: 'Aucun fichier sélectionné.',
    parseError: 'Erreur lors de la lecture du fichier CSV.'
};

// État de l'application
const state = {
    currentFile: null,
    headers: null,
    rows: null,
    cleanedRows: []
};

let dragonflyAPI;



// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    if (window.dragonflyAPI) {
        dragonflyAPI = window.dragonflyAPI;
        SecurityLogger.log('DragonflyAPI initialisée');
        initializeDropZone();
        initializeCleanButton();
    } else {
        console.error('❌ DragonflyAPI non trouvée. Vérifiez l\'ordre de chargement des scripts.');
    }
});

// Initialisation de la zone de drop
function initializeDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });
}

function initializeCleanButton() {
    const cleanButton = document.getElementById('cleanButton');
    cleanButton.addEventListener('click', handleCleanData);
    cleanButton.disabled = true;
}

async function handleFile(file) {
    SecurityLogger.log('Tentative de chargement de fichier', {
        name: file.name,
        size: file.size,
        type: file.type
    });

    try {
        if (!file) throw new Error(ERROR_MESSAGES.noFile);
        if (file.size > MAX_FILE_SIZE) throw new Error(ERROR_MESSAGES.tooLarge);
        if (!VALID_MIME_TYPES.includes(file.type) && !file.name.endsWith('.csv')) {
            throw new Error(ERROR_MESSAGES.invalidType);
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                SecurityLogger.log('Lecture du fichier réussie');
                parseCSV(sanitizeContent(e.target.result));
            } catch (error) {
                SecurityLogger.error('Erreur parsing CSV', error);
                showError(ERROR_MESSAGES.parseError);
            }
        };

        reader.onerror = (error) => {
            SecurityLogger.error('Erreur lecture fichier', error);
            showError(ERROR_MESSAGES.parseError);
        };

        reader.readAsText(file, 'UTF-8');

    } catch (error) {
        SecurityLogger.error('Erreur validation fichier', error);
        showError(error.message);
    }
}

function sanitizeContent(content) {
    return content
        .replace(/[<>]/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
        .trim();
}

function parseCSV(content) {
    try {
        content = sanitizeContent(content);
        const lines = content.split('\n');
        if (lines.length === 0) {
            SecurityLogger.error('Fichier CSV vide');
            return;
        }

        const separator = lines[0].includes(';') ? ';' : ',';
        state.headers = lines[0].split(separator).map(h => h.trim());
        state.rows = lines.slice(1)
            .filter(line => line.trim() !== '')
            .map(line => line.split(separator).map(cell => cell.trim()));

        if (!validateCSVStructure(state.headers, state.rows)) {
            SecurityLogger.error('Structure CSV invalide');
            alert('Le fichier CSV semble mal formaté');
            return;
        }

        SecurityLogger.log('Parsing CSV réussi', {
            rowCount: state.rows.length,
            headerCount: state.headers.length
        });

        document.getElementById('cleanButton').disabled = false;
        displaySourceTable();

    } catch (error) {
        SecurityLogger.error('Erreur lors du parsing CSV', error);
        alert('Erreur lors de la lecture du fichier CSV');
    }
}

function validateCSVStructure(headers, rows) {
    if (!headers.length) return false;
    const headerCount = headers.length;
    return rows.every(row => row.length === headerCount);
}

function displaySourceTable() {
    const table = document.getElementById('previewTable');
    table.innerHTML = '';

    // En-tête
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    state.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Corps
    const tbody = document.createElement('tbody');
    state.rows.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell || '-';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

function displayCleanedRow(cleanedData, tbody, originalRow) {
    const tr = document.createElement('tr');
    
    // Créer le tooltip pour l'analyse
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    document.body.appendChild(tooltip);
    
    //tooltip.innerHTML = `
    //    <div class="tooltip-content">
    //        ${marked.parse(cleanedData.analysis)}
    //    </div>
    //`;

    // Créer les cellules dans l'ordre des headers originaux
    state.headers.forEach((header, index) => {
        const td = document.createElement('td');
        
        // Trouver la donnée correspondante dans cleanedData
        const cellData = cleanedData.data.find(item => item.field === header);
        
        if (cellData) {
            // Si on a une valeur valide
            td.textContent = cellData.value || '-';
            
            // Classes de confiance
            const classes = ['confidence-cell'];
            classes.push(getConfidenceClass(cellData.confidence));
            
            // Vérifier si la valeur a été modifiée
            const originalValue = originalRow[index];
            if (originalValue !== cellData.value) {
                classes.push('cell-modified');
                td.title = `Original: "${originalValue}"\nConfiance: ${(cellData.confidence * 100).toFixed(1)}%\nNotes: ${cellData.notes}`;
            } else {
                td.title = `Confiance: ${(cellData.confidence * 100).toFixed(1)}%\nNotes: ${cellData.notes}`;
            }
            
            td.className = classes.join(' ');
        } else {
            // Si pas de donnée, afficher un tiret
            td.textContent = '-';
            td.className = 'confidence-cell confidence-error';
            td.title = 'Donnée manquante ou invalide';
        }
        
        tr.appendChild(td);
    });
    
    tbody.appendChild(tr);

    // Gestion des événements pour le tooltip
    tr.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
        tr.classList.add('active-row');
    });

    tr.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        tr.classList.remove('active-row');
    });

    tr.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let left = mouseX + 20;
        if (left + tooltipWidth > windowWidth - 20) {
            left = mouseX - tooltipWidth - 20;
        }

        let top = mouseY + 20;
        if (top + tooltipHeight > windowHeight - 20) {
            top = windowHeight - tooltipHeight - 20;
        }

        tooltip.style.left = `${Math.max(20, left)}px`;
        tooltip.style.top = `${Math.max(20, top)}px`;
    });
}

// Modifier aussi handleCleanData pour passer la ligne originale
async function handleCleanData() {
    const cleanButton = document.getElementById('cleanButton');
    cleanButton.disabled = true;

    try {
        state.cleanedRows = [];
        const resultTable = document.getElementById('resultTable');
        resultTable.innerHTML = '';

        // Création de l'en-tête
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        state.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        resultTable.appendChild(thead);

        const tbody = document.createElement('tbody');
        resultTable.appendChild(tbody);

        // Traitement de chaque ligne
        for (const row of state.rows) {
            console.log("🔄 Traitement de la ligne:", row);
            const result = await dragonflyAPI.processFullRow(row, state.headers);
            console.log("✨ Résultat obtenu:", result);
            
            if (result.success && Array.isArray(result.cleanedData)) {
                displayCleanedRow({
                    data: result.cleanedData,
                    analysis: result.analysis
                }, tbody, row);
                state.cleanedRows.push(result);
            } else {
                console.error("❌ Erreur sur la ligne:", result.error);
                displayErrorRow(row, tbody);
            }
        }

    } catch (error) {
        console.error('Erreur pendant le nettoyage:', error);
        alert('Une erreur est survenue pendant le nettoyage');
    } finally {
        cleanButton.disabled = false;
    }
}

// Fonction utilitaire pour déterminer la classe de confiance
function getConfidenceClass(confidence) {
    if (typeof confidence !== 'number') return 'confidence-25';
    
    // Convertir en pourcentage pour plus de clarté
    const confidencePercent = confidence * 100;
    
    if (confidencePercent >= 90) {
        return 'confidence-100';
    } else if (confidencePercent >= 85) {
        return 'confidence-90';
    } else if (confidencePercent >= 50) {
        return 'confidence-85';
    } else if (confidencePercent >= 25) {
        return 'confidence-50';
    } else {
        return 'confidence-25';
    }
}


function displayErrorRow(row, tbody) {
    const tr = document.createElement('tr');
    row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell || '-';
        td.className = 'confidence-cell confidence-error';
        td.title = 'Erreur de traitement';
        tr.appendChild(td);
    });
    tbody.appendChild(tr);
}

function showError(message) {
    alert(message);
}