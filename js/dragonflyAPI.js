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
        console.log("🚀 Traitement ligne complète:", { row, headers });
        try {
            const context = this.buildRowContext(row, headers);
            console.log("📝 Contexte construit:", context);
            
            const prompt = this.buildFullRowPrompt(context);
            console.log("📋 Prompt généré");
            
            const response = await this.processRow({
                prompt: prompt,
                fullRow: row
            });
            console.log("✨ Réponse API reçue:", response);

            const result = await this.parseFullRowResponse(response);
            console.log("✅ Résultat final:", result);
            return result;
        } catch (error) {
            console.error("❌ Erreur dans processFullRow:", error);
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
You are an AI assistant specialized in data cleaning and normalization for CSV datasets containing personal and professional information. 
Your task is to process each cell in the dataset, applying appropriate cleaning rules and standardizations.

<data>
${JSON.stringify(context, null, 2)}
</data>


Instructions:

1. Analyze each row in the dataset as a whole, considering the context and relationships between cells.

2. Before processing individual cells, wrap your analysis in <row_analysis> tags. In this analysis:
   - List out the content of each cell in the row.
   - Identify the cell type (e.g., Civilité, Prénom, Nom, etc.) for each cell and its corresponding cleaning rules.
   - Note any inconsistencies or potential data quality issues within the row.
   - Identify any relationships between fields (e.g., email and name) that might inform your decisions.
   - If any name or full name fields are empty, plan how to reconstruct them using available information.

3. Apply the following cleaning rules based on the cell type:

   a. Civilité (Title):
      - Use other fields (first name, last name, full name or email) in the row to infer the correct title and avoid error
      - Normalize to "Madame" or "Monsieur"

   b. Prénom (First Name):
      - Capitalize the first letter
      - Remove extra spaces
      - Correct obvious spelling errors
      - If empty, attempt to reconstruct from Nom complet or E-mail

   c. Nom (Last Name):
      - Capitalize the first letter
      - Remove extra spaces
      - Correct obvious spelling errors
      - If empty, attempt to reconstruct from Nom complet or E-mail

   d. Nom complet (Full Name):
      - Ensure it matches the combination of Prénom and Nom
      - Format as "Prénom Nom"
      - If empty, reconstruct from Prénom and Nom, or from E-mail if possible

   e. Fonction (Job Title):
      - Capitalize the first letter of each word
      - Standardize common titles (e.g., "Directeur" vs "Dir.")
      - Remove unnecessary details or duplications

   f. E-mail:
      - Ensure it's a valid email format
      - Correct obvious domain errors (e.g., missing .com or .fr)

   g. Organisation:
      - Capitalize the first letter of each word
      - Remove extra spaces
      - Correct obvious spelling errors

   h. Numéro de téléphone (Phone Number):
      - Standardize to format: 00 00 00 00 00
      - Remove any non-digit characters
      - Ensure it's a valid French phone number (10 digits)

4. Choose the most likely correction based on the context and cleaning rules.

5. Generate a confidence score for your correction (0.0 to 1.0).

6. For each cell, output a JSON object with the following structure:

   {
     "value": "normalized_value",
     "confidence": 0.0 to 1.0,
     "notes": "Brief explanation of the correction or standardization"
   }

7. Maintain consistency across the dataset, especially for recurring values like organization names or job titles.

8. If multiple interpretations are possible, choose the most likely option based on the context.

Output your results as a JSON array containing objects for each cell in the row. Here's an example of the structure (with generic content):

[
  {
    "field": "Civilité",
    "value": "normalized_value",
    "confidence": 0.0,
    "notes": "Explanation"
  },
  {
    "field": "Prénom",
    "value": "normalized_value",
    "confidence": 0.0,
    "notes": "Explanation"
  },
  // ... (continue for all fields)
]

Remember to use your <row_analysis> section to show your thought process before providing the final JSON output.

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
        try {
            const content = response.choices[0].message.content;
            console.log("📄 Contenu brut reçu:", content);
            
            // Extraction simple du JSON entre ```json et ```
            const jsonMatch = content.match(/```json\s*(\[[\s\S]*?\])\s*```/);
            if (!jsonMatch) {
                console.error("❌ Pas de JSON trouvé");
                return { success: false, error: 'JSON introuvable' };
            }
    
            // Nettoyage basique du JSON
            let jsonStr = jsonMatch[1]
                .replace(/[""]/g, '"')  // Remplace les guillemets intelligents
                .replace(/'/g, "'")     // Normalise les apostrophes
                .replace(/\/\/.*$/gm, '') // Supprime les commentaires inline
                .replace(/,(\s*[}\]])/g, '$1'); // Supprime les virgules trailing
    
            try {
                const data = JSON.parse(jsonStr);
                console.log("✅ Parsing JSON réussi:", data);
                
                // Extraction simple de l'analyse
                const analysis = content.split('```json')[0]
                    .replace(/<row_analysis>/, '')
                    .replace(/<\/row_analysis>/, '')
                    .trim();
    
                return {
                    success: true,
                    data,
                    analysis
                };
    
            } catch (parseError) {
                console.error("❌ Erreur parsing JSON:", parseError);
                console.log("JSON problématique:", jsonStr);
                return { 
                    success: false, 
                    error: parseError.message 
                };
            }
    
        } catch (error) {
            console.error("❌ Erreur générale:", error);
            return { 
                success: false, 
                error: error.message 
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