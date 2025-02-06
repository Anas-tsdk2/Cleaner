class DragonflyAPI {
    constructor() {
        this.baseUrl = 'https://ai.dragonflygroup.fr/api/v1';
        this.assistantId = 'asst_1f1UeJGMURpenLfrj4Aaykyp';
        this.cache = new Map(); // Ajout du cache
        this.CONFIDENCE_THRESHOLD = 0.7; 
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
            
            // Stocker le token seulement s'il est valide
            if (isValid) {
                TokenManager.store(token);
                console.log("💾 Token stocké avec succès");
            }
            
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
            // Étape 1 : Extraire le contenu
            let content;
            if (response.choices && response.choices[0]?.message?.content) {
                content = response.choices[0].message.content;
                console.log("📝 Contenu brut extrait:", content);
            } else {
                throw new Error("Format de réponse invalide");
            }
    
            // Étape 2 : Nettoyer le contenu
            content = content
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Supprimer les caractères de contrôle
                .replace(/\\'/g, "'") // Remplacer \' par '
                .replace(/\\"/g, '"') // Remplacer \" par "
                .replace(/[\u2018\u2019]/g, "'") // Remplacer les guillemets simples typographiques
                .replace(/[\u201C\u201D]/g, '"') // Remplacer les guillemets doubles typographiques
                .replace(/[()]/g, '')
                .trim();
    
            console.log("🧹 Contenu nettoyé:", content);
    
            // Étape 3 : Parser le JSON
            let cleanedData;
            try {
                cleanedData = JSON.parse(content);
            } catch (parseError) {
                console.error("❌ Erreur parsing JSON initial:", parseError);
                
                // Tentative de récupération en retirant les caractères problématiques
                const sanitizedContent = content
                    .replace(/\\/g, '') // Retirer tous les backslashes
                    .replace(/\s+/g, ' ') // Normaliser les espaces
                    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Ajouter des guillemets aux clés
                    .replace(/'/g, '"'); // Remplacer les apostrophes par des guillemets doubles
                
                cleanedData = JSON.parse(sanitizedContent);
            }
    
            // Étape 4 : Normaliser les données
            cleanedData = cleanedData.map(item => {
                // S'assurer que la confiance est un nombre
                let confidence = item.confidence;
                if (typeof confidence === 'string') {
                    confidence = parseFloat(confidence.replace('%', '')) / 
                        (confidence.includes('%') ? 100 : 1);
                }
                 // Si la confiance est inférieure au seuil, on la force à une valeur acceptable
                    if (confidence < this.CONFIDENCE_THRESHOLD) {
                        confidence = this.CONFIDENCE_THRESHOLD;
                     }
                return {
                    field: item.field || '',
                    value: item.value || '',
                    confidence: confidence || this.CONFIDENCE_THRESHOLD,
                    notes: item.notes || ''
                };
            });
    
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
            cleanedData: headers.map((header, index) => ({
                field: header,
                value: row[index] || '',
                confidence: 0,
                notes: "Erreur de traitement"
            }))
        };
    }

    isValidEmail(value) {
        if (!value) return false;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(value.trim());
    }
    
    isValidPhone(value) {
        if (!value) return false;
        // Nettoyer le numéro de tous les caractères non numériques
        const cleaned = value.replace(/\D/g, '');
        // Vérifier que c'est un numéro français valide (10 chiffres commençant par 0)
        return cleaned.length === 10 && /^0[1-9]/.test(cleaned);
    }
    
    formatPhone(value) {
        if (!value) return value; // Retourner la valeur d'origine si vide
        const cleaned = value.replace(/\D/g, '');
        // Si le format n'est pas valide, retourner la valeur d'origine
        if (!this.isValidPhone(cleaned)) return value;
        // Formatter en XX XX XX XX XX
        return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
}

window.dragonflyAPI = new DragonflyAPI();