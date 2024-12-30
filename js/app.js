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
    originalData: null,
    cleanedData: null
};

const dragonflyAPI = new DragonflyAPI();


// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    SecurityLogger.log('Application initialisée');
    initializeDropZone();
    initializeCleanButton();
});

// Initialisation de la zone de drop
function initializeDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    // Gestion du clic sur la zone
    dropZone.addEventListener('click', () => fileInput.click());

    // Gestion du drag & drop
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

    // Gestion de la sélection de fichier
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });
}

// Initialisation du bouton de nettoyage
function initializeCleanButton() {
    const cleanButton = document.getElementById('cleanButton');
    cleanButton.addEventListener('click', handleCleanData);
    cleanButton.disabled = true; // Désactivé par défaut
}

// Gestion sécurisée du fichier
function handleFile(file) {
    // Logging de sécurité
    SecurityLogger.log('Tentative de chargement de fichier', { 
        name: file.name, 
        size: file.size, 
        type: file.type 
    });

    // Validation du fichier
    try {
        if (!file) {
            throw new Error(ERROR_MESSAGES.noFile);
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error(ERROR_MESSAGES.tooLarge);
        }

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


// Fonction sécurisée de parsing CSV
function parseCSV(content) {
    try {
        // Sanitize le contenu avant parsing
        content = sanitizeContent(content);
        
        // Divise le contenu en lignes
        const lines = content.split('\n');
        if (lines.length === 0) {
            SecurityLogger.error('Fichier CSV vide');
            return;
        }

        // Détecte le séparateur (virgule ou point-virgule)
        const separator = lines[0].includes(';') ? ';' : ',';

        // Parse les données
        const headers = lines[0].split(separator);
        const rows = lines.slice(1)
            .filter(line => line.trim() !== '')
            .map(line => line.split(separator));

        // Vérifie la cohérence des données
        if (!validateCSVStructure(headers, rows)) {
            SecurityLogger.error('Structure CSV invalide');
            alert('Le fichier CSV semble mal formaté');
            return;
        }

        // Stocke les données originales
        state.originalData = {
            headers: headers,
            rows: rows
        };

        SecurityLogger.log('Parsing CSV réussi', { 
            rowCount: rows.length,
            headerCount: headers.length 
        });

        // Active le bouton de nettoyage
        document.getElementById('cleanButton').disabled = false;

        // Affiche les données
        displayPreview(headers, rows);
    } catch (error) {
        SecurityLogger.error('Erreur lors du parsing CSV', error);
        alert('Erreur lors de la lecture du fichier CSV');
    }
}

// Nouvelle fonction de sanitization
function sanitizeContent(content) {
    return content
        .replace(/[<>]/g, '') // Anti-XSS basique
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Supprime les caractères de contrôle
        .trim();
}


// Nouvelle fonction de validation
function validateCSVStructure(headers, rows) {
    if (!headers.length) return false;
    const headerCount = headers.length;
    return rows.every(row => row.length === headerCount);
}

// Le reste de votre code reste inchangé...
function displayPreview(headers, rows) {
    const table = document.getElementById('previewTable');
    table.innerHTML = '';

    // Crée l'en-tête
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = sanitizeCell(header.trim() || '-');
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Crée le corps du tableau
    const tbody = document.createElement('tbody');
    rows.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = sanitizeCell(cell.trim() || '-');
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

// Nouvelle fonction de sanitization des cellules
function sanitizeCell(value) {
    return value
        .replace(/[<>]/g, '')
        .trim();
}

// Le reste des fonctions de nettoyage...
async function handleCleanData() {
    console.log("🚀 Début du nettoyage");
    if (!state.originalData) {
        console.warn('Pas de données à nettoyer');
        return;
    }

    try {
        const cleanButton = document.getElementById('cleanButton');
        cleanButton.disabled = true;

        console.log("📊 Données originales:", state.originalData);

        const cleanedRows = [];
        // Traitement ligne par ligne
        for (let rowIndex = 0; rowIndex < state.originalData.rows.length; rowIndex++) {
            const row = state.originalData.rows[rowIndex];
            console.log("🔄 Traitement ligne:", row);
            
            // Nettoyer la ligne
            const cleanedRow = await Promise.all(
                row.map((cell, index) => 
                    cleanCell(cell, index, state.originalData.headers, row)
                )
            );
            cleanedRows.push(cleanedRow);

            // Mettre à jour l'affichage après chaque ligne
            state.cleanedData = {
                headers: state.originalData.headers,
                rows: cleanedRows
            };
            displayCleanedData(state.cleanedData.headers, state.cleanedData.rows);
        }

    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
        alert('Une erreur est survenue lors du nettoyage des données');
    } finally {
        cleanButton.disabled = false;
    }
}

// Fonction de nettoyage d'une cellule
async function cleanCell(cell, columnIndex, headers, currentRow) {
    if (!cell) return '-';
    
    try {
        console.log("🔍 cleanCell appelé avec:", {
            cell: cell,
            columnIndex: columnIndex,
            headerName: headers[columnIndex],
            currentRow: currentRow
        });
        
        const columnName = headers[columnIndex].trim().toLowerCase();
        console.log("📝 Appel API pour:", columnName);
        
        // Passer currentRow à processCell
        const cleanedValue = await dragonflyAPI.processCell(cell, columnName, currentRow);
        console.log("✅ Réponse API:", cleanedValue);
        
        return cleanedValue || cell;
    } catch (error) {
        console.error("❌ Erreur dans cleanCell:", error);
        return cell;
    }
}

function normalizeCivility(value) {
    value = value.toLowerCase().trim();
    if (value.includes('m.') || value.includes('mr') || value.includes('monsieur')) return 'Monsieur';
    if (value.includes('mme') || value.includes('madame')) return 'Madame';
    return value;
}

function normalizeNameCase(value) {
    return value.replace(/\s+/g, ' ')
                .trim()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
}

function cleanEmail(value) {
    if (!value.includes('@') || !value.includes('.')) return '-';
    return value.toLowerCase().trim().replace(/\s+/g, '');
}

function formatPhoneNumber(value) {
    // Garde uniquement les chiffres
    let numbers = value.replace(/\D/g, '');
    if (numbers.length !== 10) return value;
    
    // Format XX XX XX XX XX
    return numbers.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
}

function cleanFunction(value) {
    return value
        .replace(/\s+/g, ' ')
        .replace(/\/.*$/, '') // Supprime tout après un /
        .replace(/\(.*\)/, '') // Supprime les parenthèses et leur contenu
        .trim();
}

// Affiche les données nettoyées
function displayCleanedData(headers, rows) {
    const resultTable = document.getElementById('resultTable');
    resultTable.innerHTML = '';

    // Crée l'en-tête
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header.trim() || '-';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    resultTable.appendChild(thead);

    // Crée le corps du tableau
    const tbody = document.createElement('tbody');
    rows.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        row.forEach((cell, cellIndex) => {
            const td = document.createElement('td');
            const originalCell = state.originalData.rows[rowIndex][cellIndex];
            td.textContent = cell || '-';
            
            if (cell !== originalCell) {
                td.classList.add('cell-modified');
                td.title = `Original: "${originalCell}"`;
            }
            
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    resultTable.appendChild(tbody);
}

function showError(message) {
    // Vous pouvez adapter l'affichage selon votre interface
    alert(message);
}

function initializeTokenInput() {
    const tokenInput = document.getElementById('bearerToken');
    const tokenStatus = document.getElementById('tokenStatus');
    const clearButton = document.getElementById('clearToken');

    // Gérer la saisie du token
    tokenInput.addEventListener('change', (e) => {
        const token = e.target.value.trim();
        if (TokenManager.store(token)) {
            tokenStatus.textContent = 'Bearer Token enregistré ✓';
            tokenStatus.className = 'token-status success';
            SecurityLogger.log('Token enregistré avec succès');
        } else {
            tokenStatus.textContent = 'Token invalide ✗';
            tokenStatus.className = 'token-status error';
            SecurityLogger.warn('Token invalide');
        }
    });

    // Gérer le bouton d'effacement
    clearButton.addEventListener('click', () => {
        tokenInput.value = '';
        TokenManager.clear();
        tokenStatus.textContent = 'Token effacé';
        tokenStatus.className = 'token-status';
        SecurityLogger.log('Token effacé');
    });

    // Restaurer le token s'il existe
    const savedToken = TokenManager.get();
    if (savedToken) {
        tokenInput.value = savedToken;
        tokenStatus.textContent = 'Bearer Token restauré ✓';
        tokenStatus.className = 'token-status success';
    }
}

// Ajouter l'appel dans le DOMContentLoaded
// app.js
document.addEventListener('DOMContentLoaded', () => {
    // Vérifions que tous les éléments existent avant d'initialiser
    const tokenInput = document.getElementById('bearerToken');
    const tokenStatus = document.getElementById('tokenStatus');
    const clearButton = document.getElementById('clearToken');
    
    if (!tokenInput || !tokenStatus || !clearButton) {
        console.error('Éléments du token non trouvés dans le DOM');
        return;
    }

    // Fonction d'initialisation du token
    function initializeTokenInput() {
        // Gérer la saisie du token
        tokenInput.addEventListener('change', (e) => {
            const token = e.target.value.trim();
            if (TokenManager.store(token)) {
                tokenStatus.textContent = 'Bearer Token enregistré ✓';
                tokenStatus.className = 'token-status success';
                SecurityLogger.log('Token enregistré avec succès');
            } else {
                tokenStatus.textContent = 'Token invalide ✗';
                tokenStatus.className = 'token-status error';
                SecurityLogger.warn('Token invalide');
            }
        });

        // Gérer le bouton d'effacement
        clearButton.addEventListener('click', () => {
            tokenInput.value = '';
            TokenManager.clear();
            tokenStatus.textContent = 'Token effacé';
            tokenStatus.className = 'token-status';
            SecurityLogger.log('Token effacé');
        });

        // Restaurer le token s'il existe
        const savedToken = TokenManager.get();
        if (savedToken) {
            tokenInput.value = savedToken;
            tokenStatus.textContent = 'Bearer Token restauré ✓';
            tokenStatus.className = 'token-status success';
        }
    }

    // Initialiser dans cet ordre
    initializeTokenInput();
    initializeDropZone();
    initializeCleanButton();
});