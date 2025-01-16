
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

const exportButton = document.getElementById('exportButton');


// État de l'application
const state = {
    currentFile: null,
    headers: null,
    rows: null,
    cleanedRows: [],
    exportReady: false  // Nouveau flag pour gérer l'état d'export
};

let dragonflyAPI;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    if (window.dragonflyAPI) {
        dragonflyAPI = window.dragonflyAPI;
        SecurityLogger.log('DragonflyAPI initialisée');
        initializeDropZone();
        initializeCleanButton();
        initializeExportButton();  // Nouvelle fonction
    } else {
        console.error('❌ DragonflyAPI non trouvée. Vérifiez l\'ordre de chargement des scripts.');
    }
    // Initialisation de la gestion du token
    initializeTokenHandling();
});

function initializeTokenHandling() {
    const tokenInput = document.getElementById('bearerToken');
    const tokenStatus = document.getElementById('tokenStatus');
    const clearTokenButton = document.getElementById('clearToken');

    // Restaurer le token s'il existe
    const savedToken = TokenManager.get();
    if (savedToken) {
        tokenInput.value = savedToken;
        validateAndUpdateToken(savedToken);
    }

    // Gérer la saisie du token
    tokenInput.addEventListener('input', async (e) => {
        const token = e.target.value.trim();
        validateAndUpdateToken(token);
    });

    // Gérer le bouton de suppression
    clearTokenButton.addEventListener('click', () => {
        tokenInput.value = '';
        TokenManager.clear();
        tokenStatus.textContent = '';
        tokenStatus.className = 'token-status';
    });
}

async function validateAndUpdateToken(token) {
    const tokenStatus = document.getElementById('tokenStatus');
    
    if (!token) {
        tokenStatus.textContent = '';
        tokenStatus.className = 'token-status';
        return;
    }

    tokenStatus.textContent = 'Validation...';
    tokenStatus.className = 'token-status validating';

    try {
        const isValid = await dragonflyAPI.validateToken(token);
        
        if (isValid) {
            tokenStatus.textContent = '✓ Token valide';
            tokenStatus.className = 'token-status valid';
            TokenManager.store(token);
        } else {
            tokenStatus.textContent = '✗ Token invalide';
            tokenStatus.className = 'token-status invalid';
            TokenManager.clear();
        }
    } catch (error) {
        console.error('Erreur de validation du token:', error);
        tokenStatus.textContent = '✗ Erreur de validation';
        tokenStatus.className = 'token-status error';
        TokenManager.clear();
    }
}

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


// Tableau de correspondance avec accents
const FIELD_MAPPING = {
    'civilité': 'civility',
    'prénom': 'firstname',
    'nom': 'lastname',
    'nom complet': 'fullname',
    'fonction': 'jobtitle',
    'e-mail': 'email',
    'organisation': 'organization',
    'numéro de téléphone': 'phonenumber'
};

function displayCleanedRow(result, tbody, originalRow) {
    console.log("=== DÉBUT AFFICHAGE LIGNE NETTOYÉE ===");
    console.log("📊 Données reçues:", result);

    const tr = document.createElement('tr');

    // Vérifier et normaliser le format des données
    let cleanedData;
    if (result.cleanedData) {
        cleanedData = result.cleanedData;
    } else if (result.data) {
        cleanedData = result.data;
    } else {
        console.error('❌ Format de données incorrect:', result);
        displayErrorRow(originalRow, tbody);
        return;
    }

    console.log("📋 Données nettoyées à traiter:", cleanedData);

    // On parcourt les headers pour maintenir l'ordre des colonnes
    state.headers.forEach(header => {
        console.log(`\n🔍 Traitement header: "${header}"`);

        const td = document.createElement('td');

        // Conversion du header en anglais pour la recherche
        const englishField = FIELD_MAPPING[header.toLowerCase()];
        console.log(`  🔄 Conversion header: ${header} -> ${englishField}`);

        // On cherche l'élément correspondant dans les données nettoyées
        const fieldData = cleanedData.find(item => {
            const match = item.field.toLowerCase() === englishField;
            console.log(`  - Comparaison: ${item.field.toLowerCase()} avec ${englishField} => ${match}`);
            return match;
        });

        if (fieldData) {
            console.log(`  ✅ Données trouvées pour ${header}:`, fieldData);

            td.textContent = fieldData.value || '-';

            // Amélioration de la gestion de la confiance
            let confidence = fieldData.confidence;
            
            // Conversion de la confiance en nombre décimal
            if (typeof confidence === 'string') {
                confidence = parseFloat(confidence.replace('%', ''));
                if (confidence && !isNaN(confidence)) {
                    if (confidence > 1) {
                        confidence = confidence / 100;
                    }
                } else {
                    confidence = 0;
                }
            }

            // S'assurer que la confiance est un nombre valide entre 0 et 1
            confidence = Math.max(0, Math.min(1, Number(confidence) || 0));
            
            console.log(`  📊 Confiance brute: ${fieldData.confidence}`);
            console.log(`  📊 Confiance normalisée: ${confidence} (${(confidence * 100).toFixed(1)}%)`);

            const confidenceClass = getConfidenceClass(confidence);
            console.log(`  🎨 Classe de confiance: ${confidenceClass}`);

            td.className = `confidence-cell ${confidenceClass}`;

            // Ajouter le pourcentage de confiance comme attribut title
            td.title = `Confiance: ${(confidence * 100).toFixed(1)}%`;

            // Vérification si la valeur a été modifiée
            const originalValue = originalRow[state.headers.indexOf(header)];
            if (originalValue !== fieldData.value) {
                td.classList.add('cell-modified');
                console.log(`  🔄 Valeur modifiée: "${originalValue}" -> "${fieldData.value}"`);
                
                // Ajouter l'ancienne valeur au title
                td.title += `\nValeur originale: "${originalValue}"`;
            }

            // Ajouter les événements pour le tooltip seulement si on a des notes
            if (fieldData.notes) {
                td.style.cursor = 'pointer';
                td.addEventListener('mouseenter', (event) => {
                    clearTimeout(td.tooltipTimer);
                    td.tooltipTimer = setTimeout(() => {
                        showDetails(event, {
                            ...fieldData,
                            confidence: confidence, // Utiliser la confiance normalisée
                        });
                    }, 50);
                });

                td.addEventListener('mouseleave', () => {
                    clearTimeout(td.tooltipTimer);
                    const tooltip = document.querySelector('.custom-tooltip');
                    if (tooltip) {
                        tooltip.style.display = 'none';
                    }
                });
            }

        } else {
            console.log(`  ❌ Aucune donnée trouvée pour ${header}`);
            td.textContent = '-';
            td.className = 'confidence-cell confidence-error';
            td.title = 'Données non trouvées';
        }

        tr.appendChild(td);
    });

    tbody.appendChild(tr);
    console.log("=== FIN AFFICHAGE LIGNE NETTOYÉE ===\n");
}


async function handleCleanData() {
    const cleanButton = document.getElementById('cleanButton');
    const exportButton = document.getElementById('exportButton');
    const dedupeButton = document.getElementById('dedupeButton');
    
    // Désactiver tous les boutons pendant le traitement
    cleanButton.disabled = true;
    exportButton.disabled = true;
    if (dedupeButton) dedupeButton.disabled = true;

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

        // Création du tbody
        const tbody = document.createElement('tbody');
        resultTable.appendChild(tbody);

        // Traitement de chaque ligne
        let processedRows = 0;
        const totalRows = state.rows.length;

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

            // Mise à jour de la progression
            processedRows++;
            const progress = (processedRows / totalRows) * 100;
            updateProgressBar(progress);
        }

        // Activer les boutons si nous avons des données nettoyées
        if (state.cleanedRows.length > 0) {
            exportButton.disabled = false;
            
            // Gérer l'activation du bouton dedupe de manière plus sûre
            if (window.dedupeManager && typeof window.dedupeManager.enable === 'function') {
                window.dedupeManager.enable();
            } else if (dedupeButton) {
                dedupeButton.disabled = false;
                console.warn('DedupeManager non trouvé, activation directe du bouton');
            }
            
            console.log("✅ Export et dédupe activés avec", state.cleanedRows.length, "lignes");
        }

    } catch (error) {
        console.error('Erreur pendant le nettoyage:', error);
        SecurityLogger.error('Erreur pendant le nettoyage:', error);
        showError('Une erreur est survenue pendant le nettoyage');
    } finally {
        cleanButton.disabled = false;
        updateProgressBar(0); // Réinitialiser la barre de progression
    }
}

// Fonction utilitaire pour mettre à jour la barre de progression
function updateProgressBar(percentage) {
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
    }
}

// Fonction utilitaire pour déterminer la classe de confiance
function getConfidenceClass(confidence) {
    // Gérer les cas particuliers
    if (confidence === null || confidence === undefined) {
        return 'confidence-error';
    }

    // S'assurer que la confiance est un nombre
    let confidenceValue = confidence;
    if (typeof confidence === 'string') {
        // Enlever le symbole % si présent et convertir en nombre
        confidenceValue = parseFloat(confidence.replace('%', ''));
        // Si c'était en pourcentage, convertir en décimal
        if (confidence.includes('%')) {
            confidenceValue = confidenceValue / 100;
        }
    }

    // Vérifier si la conversion a échoué
    if (isNaN(confidenceValue)) {
        return 'confidence-error';
    }

    // Convertir en pourcentage pour la comparaison
    const confidencePercent = confidenceValue * 100;

    // Attribution des classes selon les seuils
    if (confidencePercent >= 95) {
        return 'confidence-100';
    } else if (confidencePercent >= 85) {
        return 'confidence-90';
    } else if (confidencePercent >= 75) {
        return 'confidence-85';
    } else if (confidencePercent >= 50) {
        return 'confidence-50';
    } else if (confidencePercent > 0) {
        return 'confidence-25';
    } else {
        return 'confidence-error';
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

function showDetails(event, fieldData) {
    const tooltip = document.querySelector('.custom-tooltip') || createTooltip();

    const markdown = `
# Détails du champ ${fieldData.field}

## Valeur
${fieldData.value}

## Confiance
${(fieldData.confidence * 100).toFixed(1)}%

## Notes de nettoyage
${fieldData.notes}
    `;

    tooltip.querySelector('.tooltip-content').innerHTML = marked.parse(markdown);
    tooltip.style.display = 'block'; // Afficher pour obtenir les dimensions

    // Récupérer les dimensions
    const rect = event.target.getBoundingClientRect();
    const tooltipHeight = tooltip.offsetHeight;
    const tooltipWidth = tooltip.offsetWidth;

    // Calcul initial des positions
    let top, left;
    const margin = 10; // Marge de sécurité

    // Déterminer la position verticale
    if (rect.bottom + tooltipHeight + margin > window.innerHeight) {
        // Pas assez de place en bas, essayer au-dessus
        top = rect.top - tooltipHeight - margin;
        tooltip.classList.add('tooltip-top');
        tooltip.classList.remove('tooltip-bottom');
    } else {
        // Assez de place en bas
        top = rect.bottom + margin;
        tooltip.classList.add('tooltip-bottom');
        tooltip.classList.remove('tooltip-top');
    }

    // Si toujours pas de place en haut, centrer verticalement sur la cellule
    if (top < margin) {
        top = Math.max(margin, rect.top + (rect.height - tooltipHeight) / 2);
        tooltip.classList.remove('tooltip-top', 'tooltip-bottom');
    }

    // Déterminer la position horizontale
    if (rect.left + tooltipWidth + margin > window.innerWidth) {
        // Pas assez de place à droite, aligner à droite de l'écran
        left = window.innerWidth - tooltipWidth - margin;
        tooltip.classList.add('tooltip-right');
        tooltip.classList.remove('tooltip-left');
    } else {
        // Aligner avec la cellule
        left = rect.left;
        tooltip.classList.add('tooltip-left');
        tooltip.classList.remove('tooltip-right');
    }

    // Appliquer les positions
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.innerHTML = '<div class="tooltip-content"></div>';
    document.body.appendChild(tooltip);
    return tooltip;
}

function closeTooltipOnClickOutside(event) {
    const tooltip = document.querySelector('.custom-tooltip');
    if (tooltip && !tooltip.contains(event.target)) {
        tooltip.style.display = 'none';
        document.removeEventListener('click', closeTooltipOnClickOutside);
    }
}

function initializeExportButton() {
    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        exportButton.addEventListener('click', handleExport);
        SecurityLogger.log('Bouton export initialisé');
    } else {
        console.error('❌ Bouton export non trouvé');
    }
}

// Ajouter cette fonction après initializeExportButton
function handleExport() {
    console.log("🚀 Début de l'export");
    const exportButton = document.getElementById('exportButton');
    
    try {
        // Vérifier qu'il y a des données à exporter
        if (!state.cleanedRows || state.cleanedRows.length === 0) {
            throw new Error('Aucune donnée à exporter');
        }

        // Créer le contenu CSV
        const csvContent = [];
        
        // Ajouter l'en-tête
        csvContent.push(state.headers.join(';'));
        
        // Ajouter les lignes nettoyées
        state.cleanedRows.forEach(row => {
            if (row.cleanedData) {
                const rowData = state.headers.map(header => {
                    const englishField = FIELD_MAPPING[header.toLowerCase()];
                    const field = row.cleanedData.find(item => 
                        item.field.toLowerCase() === englishField
                    );
                    return field ? `"${field.value.replace(/"/g, '""')}"` : '""';
                });
                csvContent.push(rowData.join(';'));
            }
        });

        // Créer le blob avec BOM UTF-8
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent.join('\n')], { 
            type: 'text/csv;charset=utf-8' 
        });

        // Créer le lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `donnees_nettoyees_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        
        // Déclencher le téléchargement
        link.click();
        
        // Nettoyer
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log("✅ Export terminé avec succès");

    } catch (error) {
        console.error('❌ Erreur lors de l\'export:', error);
        alert('Une erreur est survenue lors de l\'export: ' + error.message);
    }
}