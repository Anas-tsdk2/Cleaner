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
            // PHASE 1 : Détection Programmatique
            if (['e-mail', 'numéro de téléphone', 'organisation'].includes(type)) {
                let cleanedValue = value;

                switch (type) {
                    case 'e-mail':
                        // 1.1 Regex trouve emails
                        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
                        for (let cell of currentRow) {
                            const match = cell?.match(emailRegex);
                            if (match) {
                                cleanedValue = match[0];
                                break;
                            }
                        }
                        if (!cleanedValue.includes('@')) {
                            cleanedValue = cleanedValue.replace(/\s+/g, '@');
                        }
                        return cleanedValue.toLowerCase();

                    case 'numéro de téléphone':
                        const digits = value?.replace(/\D/g, '');
                        if (digits?.length === 10) {
                            return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
                        }
                        return '-';

                    case 'organisation':
                        const sigleRegex = /\b(SA|SARL|SAS)\b/i;
                        const sigleMatch = value?.match(sigleRegex);
                        if (sigleMatch) {
                            cleanedValue = value.replace(sigleRegex, sigleMatch[0].toUpperCase());
                        }
                        return cleanedValue;
                }
            }

            // Créer le contexte une seule fois
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

            // PHASE 2 : Traiter d'abord tous les champs sauf civilité
            if (type !== 'civilité') {
                let rules;
                switch (type) {
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
                }

                if (rules) {
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
                    } catch (e) {
                        console.error('Erreur extraction value:', e);
                        return value;
                    }
                }
            }

            // PHASE 3 : Traiter explicitement la civilité à la fin
            if (type === 'civilité' || (currentRow[0] === '' && context.prenom)) {
                console.log("🎭 Traitement civilité basé sur:", {
                    prenom: context.prenom,
                    fonction: context.fonction,
                    titre: context.civilite
                });


                const prompt = `OBJECTIF: Déterminer la civilité
            ENTRÉE:
            - Prénom: "${currentRow[1]}"
            - Fonction: "${currentRow[4]}"
            - Titre actuel: "${currentRow[0]}"

            RÈGLES:
            1. Si fonction contient "Directrice" -> "Madame"
            2. Sinon, détermine si le prénom est masculin ou féminin
            SORTIE ATTENDUE: {"value": "Monsieur ou Madame"}`;

                const response = await this.processRow({
                    value: context.civilite,
                    type: 'civilité',
                    prompt: prompt
                });

                try {
                    const content = response.choices?.[0]?.message?.content;
                    const jsonMatch = content.match(/\{[^{]*"value"\s*:\s*"([^"]+)"[^}]*\}/);
                    return jsonMatch?.[1] || '-';
                } catch (e) {
                    return '-';
                }
            }

            return value;
        } catch (error) {
            console.error('Erreur traitement cellule:', error);
            return type === 'civilité' ? '-' : value;
        }
    }

    async validateWithLLM(value, type, prompt) {
        const response = await this.processRow({
            value: value,
            type: type,
            prompt: prompt
        });

        try {
            const content = response.choices?.[0]?.message?.content;
            const jsonMatch = content.match(/\{[^{]*"value"\s*:\s*"([^"]+)"[^}]*\}/);
            const cleanedValue = jsonMatch?.[1];

            // Ne jamais retourner les valeurs codées en dur
            if (['email_validé', 'téléphone_validé', 'organisation_standardisée'].includes(cleanedValue)) {
                return value;
            }

            // Pour les valeurs invalides
            if (cleanedValue === '-' || !cleanedValue) {
                if (type === 'e-mail' || type === 'numéro de téléphone') {
                    return '-';
                }
                return value;
            }

            return cleanedValue;
        } catch (e) {
            console.error('Erreur validation LLM:', e);
            // En cas d'erreur, retourner '-' pour email et téléphone, sinon la valeur originale
            if (type === 'e-mail' || type === 'numéro de téléphone') {
                return '-';
            }
            return value;
        }
    }

    // Méthode utilitaire pour vérifier si une valeur est un email valide
    isValidEmail(value) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(value);
    }

    // Méthode utilitaire pour vérifier si une valeur est un téléphone valide
    isValidPhone(value) {
        const phoneRegex = /^(\d{2}\s){4}\d{2}$/;
        return phoneRegex.test(value);
    }

    // Méthode utilitaire pour formater un numéro de téléphone
    formatPhone(value) {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 10) return '-';
        return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
}


// Export de l'instance unique
window.dragonflyAPI = new DragonflyAPI();