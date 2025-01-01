class DragonflyAPI {
    constructor() {
        this.baseUrl = 'https://ai.dragonflygroup.fr/api/v1';
        this.assistantId = 'asst_1f1UeJGMURpenLfrj4Aaykyp';
    }

    setAssistantId(id) {
        console.log("🔧 Changement d'assistant ID:", id);
        this.assistantId = id;
    }

    async validateToken(token) {
        console.log("🔑 Validation du token...");
        try {
            const response = await fetch(`${this.baseUrl}/user/assistants`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const isValid = response.ok;
            console.log(isValid ? "✅ Token valide" : "❌ Token invalide");
            return isValid;
        } catch (error) {
            console.error("❌ Erreur validation token:", error);
            return false;
        }
    }

    async getAssistants() {
        console.log("📋 Récupération des assistants");
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

    async processFullRow(row, headers) {
        try {
            console.log("🚀 Début traitement ligne:", row);
            const context = this.buildRowContext(row, headers);
            
            const prompt = this.buildFullRowPrompt(context);
            
            const response = await this.processRow({
                prompt: prompt,
                fullRow: row
            });
            console.log("✨ Réponse API brute:", response);
    
            if (!response || !response.choices || !response.choices[0]) {
                throw new Error('Réponse API invalide');
            }
    
            const result = await this.parseFullRowResponse(response);
            console.log("✅ Résultat final:", result);
            return result;
        } catch (error) {
            console.error("❌ Erreur dans processFullRow:", error);
            console.error("Détails de l'erreur:", {
                message: error.message,
                stack: error.stack
            });
            return this.generateErrorResponse(row, headers);
        }
    }

    buildRowContext(row, headers) {
        const context = {};
        headers.forEach((header, index) => {
            context[this.normalizeHeader(header)] = row[index] || '';
        });
        return context;
    }

    normalizeHeader(header) {
        return header
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '_');
    }

    buildFullRowPrompt(context) {
        return `
**Nettoyage & Normalisation de Données CSV**

* **Entrée** : ${JSON.stringify(context, null, 2)}

* **Règles de Traitement Spécifiques (appliquées automatiquement)** :
	### a. Civilité (Title)
	+ Normaliser à "Madame" pour prénom féminin et "Monsieur" pour prénom masculin
	+ Vérification croisée avec : préfixe E-mail, Nom complet, indicateurs de genre dans tous les champs

	### b. Prénom (First Name)
	+ Mettre en majuscule la première lettre
	+ Supprimer les espaces supplémentaires
	+ Corriger les erreurs d'orthographe évidentes
	+ Si vide, essayer de reconstruire à partir du Nom complet ou de l'E-mail

	### c. Nom (Last Name)
	+ Mettre en majuscule la première lettre
	+ Supprimer les espaces supplémentaires
	+ Corriger les erreurs d'orthographe évidentes
	+ Si vide, essayer de reconstruire à partir du Nom complet ou de l'E-mail

	### d. Nom Complet (Full Name)
	+ S'assurer qu'il correspond à la combinaison de Prénom et Nom
	+ Formatter comme "Prénom Nom"
	+ Si vide, reconstruire à partir de Prénom et Nom, ou à partir de l'E-mail si possible

	### e. Fonction (Job Title)
	+ Mettre en majuscule la première lettre de chaque mot
	+ Standardiser les titres courants (ex : "Directeur" au lieu de "Dir.")
	+ Supprimer les détails inutiles ou les duplications
	+ Supprimer tout texte entre parenthèses, y compris les parenthèses

	### f. E-mail
	+ S'assurer que c'est un format d'e-mail valide
	+ Corriger les erreurs de domaine évidentes (ex : absence de .com ou .fr)

	### g. Organisation
	+ Mettre en majuscule la première lettre de chaque mot
	+ Supprimer les espaces supplémentaires
	+ Corriger les erreurs d'orthographe évidentes

	### h. Numéro de Téléphone
	+ Standardiser au format : 00 00 00 00 00
	+ Supprimer les caractères non numériques
	+ S'assurer qu'il s'agit d'un numéro de téléphone français valide (10 chiffres)

**Tâche** :
	1. Traitez l'exemple de données d'entrée ci-dessus en appliquant les règles spécifiques.
    2. Ne pas inclure de remarques, d'explications ou de textes supplémentaires dans la réponse. Seul le JSON de sortie est requis.**
	3. **Réponse attendue : UNIQUEMENT le JSON de Sortie résultant (exécutable par script)**  :

[
  {"field": "Civility", "value": "...", "confidence": ..., "notes": "..."},
  {"field": "FirstName", "value": "...", "confidence": ..., "notes": "..."},
  {"field": "LastName", "value": "...", "confidence": ..., "notes": "..."},
  {"field": "FullName", "value": "...", "confidence": ..., "notes": "..."},
  {"field": "JobTitle", "value": "...", "confidence": ..., "notes": "..."},
  {"field": "Email", "value": "...", "confidence": ..., "notes": "..."},
  {"field": "Organization", "value": "...", "confidence": ..., "notes": "..."},
  {"field": "PhoneNumber", "value": "...", "confidence": ..., "notes": "..."}
]
`;
    }

    async readStream(reader) {
        let result = '';
        const decoder = new TextDecoder();
        console.log("📖 Début lecture stream");

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    console.log("✅ Fin lecture stream");
                    break;
                }

                const chunk = decoder.decode(value);

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
                            if (jsonStr.trim()) {
                                console.debug('⚠️ Chunk non parsable:', jsonStr);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("❌ Erreur lecture stream:", error);
        }

        console.log("🎯 Résultat stream complet:", result);
        return result.trim();
    }

    async processRow(rowData) {
        console.log("🔄 Traitement row:", rowData);
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
                        text: rowData.prompt
                    }]
                }],
                assistantId: this.assistantId,
                temperature: 1,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Erreur API: ${response.status} ${error.message || ''}`);
        }

        const reader = response.body.getReader();
        const result = await this.readStream(reader);

        return {
            choices: [{
                message: {
                    content: result
                }
            }]
        };
    }

   
    async parseFullRowResponse(response) {
        console.log("🔍 Début parseFullRowResponse avec:", response);
        
        try {
            // Étape 1 : Extraire les données du format de réponse
            let cleanedData;
            
            if (Array.isArray(response)) {
                cleanedData = response;
            } else if (typeof response === 'string') {
                cleanedData = JSON.parse(response);
            } else if (response && response.choices && response.choices[0]?.message?.content) {
                // Nouveau cas : extraire le contenu du message
                const content = response.choices[0].message.content;
                console.log("📝 Contenu brut extrait:", content);
                
                // Nettoyer le contenu avant le parsing
                const cleanContent = content
                    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Supprimer les caractères de contrôle
                    .replace(/'/g, "'") // Remplacer les apostrophes courbes par des droites
                    .replace(/`/g, "'") // Remplacer les backticks par des apostrophes
                    .replace(/[\u2018\u2019]/g, "'") // Remplacer les guillemets simples typographiques
                    .replace(/[\u201C\u201D]/g, '"'); // Remplacer les guillemets doubles typographiques
                
                console.log("🧹 Contenu nettoyé:", cleanContent);
                
                try {
                    cleanedData = JSON.parse(cleanContent);
                } catch (parseError) {
                    console.error("❌ Erreur parsing JSON initial:", parseError);
                    // Tentative de récupération en retirant les caractères problématiques
                    const sanitizedContent = cleanContent.replace(/[^\x20-\x7E]/g, "");
                    cleanedData = JSON.parse(sanitizedContent);
                }
            } else if (response && Array.isArray(response.cleanedData)) {
                cleanedData = response.cleanedData;
            } else {
                throw new Error("Format de données invalide");
            }
            
            console.log("📥 Données brutes récupérées:", cleanedData);
    
            // Étape 2 : Normalisation des données
            cleanedData = cleanedData.map(item => {
                // Vérifier que l'item est un objet valide
                if (!item || typeof item !== 'object') {
                    console.warn("⚠️ Item invalide détecté:", item);
                    return null;
                }
    
                // Normalisation de la confiance
                let confidence;
                if (typeof item.confidence === 'string') {
                    // Gérer les cas comme "100%" ou "0.8"
                    confidence = parseFloat(item.confidence.replace('%', '')) / 
                        (item.confidence.includes('%') ? 100 : 1);
                } else if (typeof item.confidence === 'number') {
                    confidence = item.confidence;
                } else {
                    confidence = 0;
                    console.warn("⚠️ Confiance invalide pour:", item);
                }
    
                // S'assurer que la confiance est entre 0 et 1
                confidence = Math.max(0, Math.min(1, confidence));
    
                return {
                    field: item.field || '',
                    value: item.value || '',
                    confidence: confidence,
                    notes: item.notes || ''
                };
            }).filter(item => item !== null);
    
            console.log("✨ Données normalisées:", cleanedData);
    
            return {
                success: true,
                cleanedData: cleanedData,
                analysis: ''
            };
    
        } catch (error) {
            console.error("❌ Erreur dans parseFullRowResponse:", error);
            console.error("📄 Données problématiques:", response);
            return {
                success: false,
                cleanedData: [],
                analysis: error.message
            };
        }
    }
    
    generateErrorResponse(row, headers) {
        return {
            success: false,
            headers:data.map((header, index) => ({
                field: header,
                value: row[index] || '',
                confidence: 0,
                notes: "Erreur de traitement"
            }))
        };
    }

    isValidEmail(value) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(value);
    }

    isValidPhone(value) {
        const phoneRegex = /^(\d{2}\s){4}\d{2}$/;
        return phoneRegex.test(value);
    }

    formatPhone(value) {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 10) return '-';
        return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
}

window.dragonflyAPI = new DragonflyAPI();