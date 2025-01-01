// Constantes
const DEDUPE_FIELDS = ['prenom', 'nom'];

class DedupeManager {
    constructor() {
        this.duplicateGroups = [];
        this.initializeButton();
    }

    initializeButton() {
        const dedupeButton = document.getElementById('dedupeButton');
        if (dedupeButton) {
            dedupeButton.addEventListener('click', () => this.handleDedupe());
            SecurityLogger.log('Bouton dédupe initialisé');
        }
    }

    // Active le bouton de déduplication
    enable() {
        const dedupeButton = document.getElementById('dedupeButton');
        if (dedupeButton) {
            dedupeButton.disabled = false;
        }
    }

    // Désactive le bouton de déduplication
    disable() {
        const dedupeButton = document.getElementById('dedupeButton');
        if (dedupeButton) {
            dedupeButton.disabled = true;
        }
    }

    findDuplicates(rows) {
        const groups = {};

        rows.forEach((row, index) => {
            // Crée une clé unique basée sur prénom et nom
            const key = DEDUPE_FIELDS.map(field => {
                const englishField = FIELD_MAPPING[field];
                const fieldData = row.cleanedData.find(item =>
                    item.field.toLowerCase() === englishField
                );
                return fieldData ? fieldData.value.toLowerCase() : '';
            }).join('|');

            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push({ index, row });
        });

        // Ne garde que les groupes avec des doublons
        return Object.values(groups).filter(group => group.length > 1);
    }

    async handleDedupe() {
        console.log("🔍 Début de la déduplication");

        try {
            // Récupère les données du state global
            this.duplicateGroups = this.findDuplicates(state.cleanedRows);

            if (this.duplicateGroups.length === 0) {
                alert('Aucun doublon trouvé');
                return;
            }

            console.log("🎯 Groupes de doublons trouvés:", this.duplicateGroups.length);
            this.showModal();

        } catch (error) {
            console.error('❌ Erreur pendant la déduplication:', error);
            alert('Une erreur est survenue pendant la déduplication');
        }
    }
    // Ajouter cette méthode dans la classe DedupeManager
    showModal() {
        const modal = document.createElement('div');
        modal.className = 'dedupe-modal';
        modal.innerHTML = `
            <h2>Lignes similaires détectées</h2>
            <p>Sélectionnez les versions à conserver pour chaque doublon</p>
            <div class="dedupe-groups"></div>
            <div class="dedupe-actions">
                <button class="button" id="applyDedupe">Appliquer</button>
                <button class="button" id="cancelDedupe">Annuler</button>
            </div>
        `;
    
        const backdrop = document.createElement('div');
        backdrop.className = 'dedupe-modal-backdrop';
    
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
    
        const groupsContainer = modal.querySelector('.dedupe-groups');
        
        // Pour chaque groupe de doublons
        this.duplicateGroups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'dedupe-group';
    
            // Utiliser le nom complet comme titre du groupe
            const firstRow = group[0].row.cleanedData.find(item => 
                item.field.toLowerCase() === 'fullname'
            );
            const groupTitle = firstRow ? firstRow.value : 'Doublons détectés';
            groupDiv.innerHTML = `<h3>${groupTitle}</h3>`;
    
            // Afficher chaque version de la ligne
            group.forEach(({ row, index }) => {
                const rowDiv = document.createElement('div');
                rowDiv.className = 'dedupe-row';
                rowDiv.dataset.index = index;
                
                // Créer une présentation détaillée de la ligne
                const rowDetails = state.headers.map(header => {
                    const englishField = FIELD_MAPPING[header.toLowerCase()];
                    const fieldData = row.cleanedData.find(item => 
                        item.field.toLowerCase() === englishField
                    );
                    if (fieldData) {
                        return `<div class="field-detail">
                            <span class="field-name">${header}:</span>
                            <span class="field-value">${fieldData.value}</span>
                        </div>`;
                    }
                    return '';
                }).join('');
                
                rowDiv.innerHTML = rowDetails;
                
                // Ajouter la sélection avec une case à cocher
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'dedupe-checkbox';
                checkbox.checked = true; // Par défaut, toutes les lignes sont sélectionnées
                
                rowDiv.insertBefore(checkbox, rowDiv.firstChild);
                
                // Permettre la sélection en cliquant sur toute la ligne
                rowDiv.addEventListener('click', (e) => {
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                    }
                    rowDiv.classList.toggle('selected', checkbox.checked);
                });
                
                // Initialiser la classe selected
                rowDiv.classList.toggle('selected', checkbox.checked);
                
                groupDiv.appendChild(rowDiv);
            });
    
            groupsContainer.appendChild(groupDiv);
        });
    
        // Gestionnaires d'événements pour les boutons
        modal.querySelector('#applyDedupe').addEventListener('click', () => {
            const selectedIndices = new Set(
                Array.from(modal.querySelectorAll('.dedupe-row.selected'))
                    .map(row => parseInt(row.dataset.index))
            );
    
            // Ne modifier que les lignes concernées par la déduplication
            const affectedIndices = new Set(
                this.duplicateGroups.flatMap(group => 
                    group.map(item => item.index)
                )
            );
    
            // Filtrer uniquement les lignes qui sont dans les groupes de doublons
            state.cleanedRows = state.cleanedRows.filter((_, index) => 
                !affectedIndices.has(index) || selectedIndices.has(index)
            );
    
            this.closeModal(modal, backdrop);
            this.refreshDisplay();
        });
    
        modal.querySelector('#cancelDedupe').addEventListener('click', () => {
            this.closeModal(modal, backdrop);
        });
    
        // Afficher la modal
        backdrop.style.display = 'block';
        modal.style.display = 'block';
    }

    closeModal(modal, backdrop) {
        document.body.removeChild(modal);
        document.body.removeChild(backdrop);
    }

    refreshDisplay() {
        // Réafficher le tableau avec les lignes filtrées
        const resultTable = document.getElementById('resultTable');
        const tbody = resultTable.querySelector('tbody');
        tbody.innerHTML = '';

        state.cleanedRows.forEach((result, index) => {
            if (result.success && Array.isArray(result.cleanedData)) {
                displayCleanedRow({
                    data: result.cleanedData,
                    analysis: result.analysis
                }, tbody, state.rows[index]);
            }
        });
    }
}

// Export de l'instance
window.dedupeManager = new DedupeManager();