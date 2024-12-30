/**
 * Client API pour communiquer avec Dragonfly API
 */
class DragonflyAPI {
    constructor() {
        this.baseUrl = 'https://ai.dragonflygroup.fr/api/v1';
        this.assistantId = 'asst_1f1UeJGMURpenLfrj4Aaykyp';
        this.currentRow = null; // Pour stocker la ligne en cours
    }

    /**
     * Change l'ID de l'assistant utilisé
     */
    setAssistantId(id) {
        this.assistantId = id;
    }

    /**
     * Vérifie si un token est valide en essayant de récupérer les assistants
     */
    async validateToken(token) {
        try {
            const response = await fetch(`${this.baseUrl}/user/assistants`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Erreur validation token:', error);
            return false;
        }
    }

    /**
     * Récupère la liste des assistants disponibles
     */
    async getAssistants() {
        const token = TokenManager.get();
        if (!token) throw new Error('Token manquant');

        const response = await fetch(`${this.baseUrl}/user/assistants`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Erreur récupération assistants');
        return await response.json();
    }

    /**
     * Lit et concatène les données d'un stream
     */
    async readStream(reader) {
        let result = '';
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                //console.log("Chunk reçu:", chunk); // Debug

                // Sépare les lignes et traite chaque ligne
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('data:')) {
                        const jsonStr = line.replace('data:', '').trim();
                        if (jsonStr === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(jsonStr);
                            if (parsed.choices?.[0]?.delta?.content) {
                                result += parsed.choices[0].delta.content;
                            } else if (parsed.choices?.[0]?.message?.content) {
                                result += parsed.choices[0].message.content;
                            }
                        } catch (e) {
                            // Ignore les erreurs de parsing JSON pour les lignes incomplètes
                            if (jsonStr.trim()) {
                                console.debug('Ligne non parsable:', jsonStr);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Erreur lecture stream:', error);
        }

        // Nettoyage final
        result = result.trim();
        console.log("Résultat final:", result); // Debug

        return result;
    }

    /**
     * Traite une ligne de données via l'API
     */
    async processRow(rowData) {
        // Stocker la ligne courante si disponible
        if (rowData.fullRow) {
            this.currentRow = rowData.fullRow;
        }

        const token = TokenManager.get();
        if (!token) throw new Error('Token manquant');

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [{
                    role: "user",
                    content: [{
                        type: "text",
                        text: rowData.prompt || `Nettoie cette donnée de type ${rowData.type}: "${rowData.value}"`
                    }]
                }],
                assistantId: this.assistantId,
                temperature: 1,
                stream: true,
                stream_options: {
                    include_usage: true,
                    continuous_usage_stats: false
                }
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Erreur API: ${response.status} ${error.message || ''}`);
        }

        // Lecture du stream
        const reader = response.body.getReader();
        const result = await this.readStream(reader);

        // On retourne un objet qui imite la structure de réponse non-streamée
        return {
            choices: [{
                message: {
                    content: result
                }
            }]
        };
    }

    /**
     * Traite une cellule unique
     */
    async processCell(value, type, currentRow) {
        try {
            // Pour email, chercher dans toute la ligne
            if (type === 'e-mail') {
                const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
                for (let cell of currentRow) {
                    const match = cell?.match(emailRegex);
                    if (match) {
                        value = match[0];
                        break;
                    }
                }
            }
    
            // Si on traite nom_complet, le faire en premier car référence
            const nomComplet = currentRow[3]; // Colonne nom_complet
            if (nomComplet) {
                const [prenom, nom] = nomComplet.split(' ');
                
                // Correction prénom si vide ou décalé
                if (type === 'prénom' && (!value || value === '-' || value === '')) {
                    value = prenom;
                }
                // Correction nom si vide ou contient un prénom
                if (type === 'nom' && (!value || value === prenom)) {
                    value = nom;
                }
            }
    
            // Traitement spécial pour civilité
            if (type === 'civilité') {
                const prenom = currentRow[1] || nomComplet?.split(' ')[0];
                const fonction = currentRow[4];
                const prenomsFeminins = ['anaïs', 'aurélia', 'anne', 'sophie', 'marie'];
                
                if (fonction?.toLowerCase().includes('directrice') || 
                    prenomsFeminins.includes(prenom?.toLowerCase()) ||
                    (prenom?.toLowerCase().endsWith('e') && 
                     !['baptiste', 'étienne', 'philippe'].includes(prenom?.toLowerCase()))) {
                    return 'Madame';
                }
                return 'Monsieur';
            }
    
            // Types à traiter même si vides
            const alwaysProcess = ['civilité', 'prénom', 'nom', 'e-mail', 'organisation'];
            
            if (!alwaysProcess.includes(type) && (!value || value.trim() === '' || value === '\r')) {
                return '-';
            }
    
            const context = currentRow ? {
                civilite: currentRow[0] || '',
                prenom: currentRow[1] || '',
                nom: currentRow[2] || '',
                nom_complet: currentRow[3] || '',
                fonction: currentRow[4] || '',
                email: currentRow[5] || '',
                organisation: currentRow[6] || '',
                telephone: currentRow[7] || ''
            } : {};
    
            let rules;
            switch(type) {
                case 'civilité':
                    rules = `RÈGLES:
    - IMPORTANT: Pour prénom="${context.prenom}":
      * Si prénom féminin connu (Anaïs, Aurélia) -> "Madame"
      * Si fonction contient "Directrice" -> "Madame"
      * Si prénom finit par "e" (sauf Baptiste, Étienne) -> "Madame"
      * Sinon -> "Monsieur"
    - Toujours retourner "Monsieur" ou "Madame"`;
                    break;
    
                case 'prénom':
                    rules = `RÈGLES:
    - Si valeur vide ou "-":
      * Utiliser premier mot du nom_complet
      * Si pas trouvé, regarder si le nom est un prénom
    - Première lettre majuscule, reste en minuscules
    - Garder les accents
    - Ex: "jean-pierre" -> "Jean-Pierre"`;
                    break;
    
                case 'nom':
                    rules = `RÈGLES:
    - Si la valeur est un prénom et que prénom="-":
      * Utiliser le nom depuis nom_complet
      * Ex: prénom="-" et nom="Loïc" -> prendre "Lebrun" depuis "Loïc Lebrun"
    - Sinon appliquer règles standard:
      * Première lettre majuscule
      * Reste en minuscules
      * Garder les accents`;
                    break;
    
                case 'nom complet':
                    rules = `RÈGLES:
    - Format "Prénom Nom"
    - Utiliser le contexte pour reconstruire si nécessaire
    - Première lettre de chaque mot en majuscule
    - Garder les accents
    - Ex: "DURAND Antoine" -> "Antoine Durand"`;
                    break;
    
                case 'fonction':
                    rules = `RÈGLES:
    - Garder DSI, PDG, DRH, RSSI en majuscules
    - Si "Directeur/trice des Systèmes d'Information" -> "DSI"
    - Si "Responsable Sécurité" + "Systèmes" -> "RSSI"
    - Supprimer tout après "/"
    - Pour les autres: première lettre majuscule`;
                    break;
    
                case 'e-mail':
                    rules = `RÈGLES:
    - Valeur trouvée: "${value}"
    - Tout en minuscules
    - Supprimer les espaces
    - Format: xxx@yyy.zzz
    - Si invalide -> "-"`;
                    break;
    
                case 'numéro de téléphone':
                    rules = `RÈGLES:
    - Garder uniquement les chiffres
    - Si moins de 10 chiffres -> "-"
    - Format XX XX XX XX XX
    - Supprimer points et caractères spéciaux`;
                    break;
    
                case 'organisation':
                    rules = `RÈGLES:
    - Première lettre des mots en majuscule
    - Garder SA, SARL, SAS en majuscules
    - Standardiser les "&" et "et"
    - Ex: "mark & comm" -> "Mark & Comm"`;
                    break;
            }
    
            const prompt = `OBJECTIF: Nettoyer la donnée en utilisant le contexte
    ENTRÉE: "${value}"
    TYPE: ${type}
    CONTEXTE: ${JSON.stringify(context, null, 2)}
    ${rules}
    SORTIE ATTENDUE: {"value": "valeur_nettoyée"}
    CONTRAINTE: Retourne uniquement le JSON avec la valeur nettoyée.`;
    
            const response = await this.processRow({
                value: value,
                type: type,
                prompt: prompt
            });
    
            try {
                const content = response.choices?.[0]?.message?.content;
                const jsonMatch = content.match(/\{[^{]*"value"\s*:\s*"([^"]+)"[^}]*\}/);
                if (jsonMatch && jsonMatch[1]) {
                    return jsonMatch[1];
                }
                return type === 'civilité' ? 'Monsieur' : value;
            } catch (e) {
                console.error('Erreur extraction value:', e);
                return type === 'civilité' ? 'Monsieur' : value;
            }
        } catch (error) {
            console.error('Erreur traitement cellule:', error);
            return type === 'civilité' ? 'Monsieur' : value;
        }
    }
}


// Export de l'instance unique
window.dragonflyAPI = new DragonflyAPI();