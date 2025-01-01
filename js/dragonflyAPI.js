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
You are an AI assistant specialized in data cleaning and normalization for CSV datasets containing personal and professional information. 
Your task is to process each cell in the dataset, applying appropriate cleaning rules and standardizations.

<data>
${JSON.stringify(context, null, 2)}
</data>


Instructions:

1. Analyze each row in the dataset as a whole, considering the context and relationships between cells.


2. For each row, create a <row_analysis> block containing:
- Content of each cell in the row
- Cell type (Title, First Name, Last Name, etc.) and associated cleaning rules
- Inconsistencies or potential data quality issues
- Relationships between fields (e.g., email and name)
- Reconstruction plan if fields are missing

3. Apply the following cleaning rules based on the cell type:

   a. Civilité (Title):
      - Normalize to "Madame" for female first name and "Monsieur" for male first name.   
      - Cross-verification with:
        - Email prefix
        - Full name
        - Gender indicators in all fields
      
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
      - Remove all text between parentheses, including the parentheses themselves

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

6.  For each cell, create a JSON object with the following structure:

   {
     "field": "Field Name",
     "value": "normalized_value",
     "confidence": 0.0 to 1.0,
     "notes": "Brief explanation of the correction or standardization"
   }

   Important: 
    - Do not create JSON objects for empty fields or fields without a clear purpose.
    - Always normalize formats as specified in the cleaning rules, even if the original format is understandable.
    - If a field cannot be normalized or reconstructed, set its value to null and explain why in the notes.
    - Do not surround the JSON value with additional quotes, code tags like 3 backticks json, or any other superfluous characters or text.
    - Do not put values in quotes (e.g., numbers or names) in the JSON object.
    - Do not add any comments in JSON objects. All explanations must be placed in the "notes" field.

7. Maintain consistency across the dataset, especially for recurring values like organization names or job titles.

8. If multiple interpretations are possible, choose the most likely option based on the context.

<row_analysis>
1. Content 1: [Content]
   Type: [Cell Type]
   Issues: [Any inconsistencies or quality issues]
   Relationships: [Any relationships with other fields]
   Cleaning Rules: [List rules]

2. Content 2: [Content]
   Type: [Cell Type]
   Issues: [Any inconsistencies or quality issues]
   Relationships: [Any relationships with other fields]
   Cleaning Rules: [List rules]

[Continue for all cells in the row]
</row_analysis>

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
  // ... (continue for all fields in the row)
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
            
            // Chercher le dernier tableau JSON
            const jsonRegex = /\[\s*{[\s\S]*?\]\s*$/;
            const jsonMatch = content.match(jsonRegex);
    
            if (!jsonMatch) {
                console.error("❌ Aucun bloc JSON trouvé");
                return { success: false, error: 'JSON introuvable' };
            }
    
            try {
                // Nettoyer le JSON avant parsing
                let jsonStr = jsonMatch[0]
                    // Supprimer les commentaires inline avec leur contenu
                    .replace(/,?\s*\/\/.*$/gm, '');
            
                // Parser puis re-stringify pour un formatage propre
                let tempData = JSON.parse(jsonStr);
                jsonStr = JSON.stringify(tempData, null, 2);
            
                console.log("🔍 JSON nettoyé:", jsonStr);
            
                const data = JSON.parse(jsonStr);
                
                // Filtrer les entrées invalides
                const cleanedData = data
                    .filter(item => 
                        item &&
                        typeof item === 'object' &&
                        item.field?.trim() &&
                        (item.value === 'null' || item.value?.trim()) &&
                        typeof item.confidence === 'number' &&
                        item.confidence >= 0 &&
                        item.confidence <= 1
                    )
                    .map(item => ({
                        field: item.field.trim(),
                        value: item.value === 'null' ? null : item.value.trim(),
                        confidence: item.confidence,
                        notes: item.notes.trim()
                    }));
    
                // Extraction de l'analyse
                const analysisMatch = content.match(/<row_analysis>([\s\S]*?)<\/row_analysis>/);
                const analysis = analysisMatch ? analysisMatch[1].trim() : '';
    
                return {
                    success: true,
                    cleanedData,
                    analysis
                };
    
            } catch (jsonError) {
                console.error("❌ Erreur parsing JSON:", jsonError);
                console.log("JSON problématique:", jsonStr);
                return { 
                    success: false, 
                    error: jsonError.message 
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