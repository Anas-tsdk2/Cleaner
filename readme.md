# Documentation - Cora's CSV Cleaner v1.0

## Table des matières
1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Fonctionnalités](#fonctionnalités)
5. [Sécurité](#sécurité)
6. [API](#api)
7. [Interface utilisateur](#interface-utilisateur)
8. [Guide d'utilisation](#guide-dutilisation)

## Introduction

Cora's CSV Cleaner est une application web standalone permettant de nettoyer et standardiser des fichiers CSV contenant des données de contact. Elle utilise l'API Dragonfly AI pour effectuer un nettoyage intelligent des données.

### Objectifs principaux
- Normaliser les données de contact (noms, emails, téléphones, etc.)
- Détecter et gérer les doublons
- Fournir une interface simple et intuitive
- Garantir la sécurité des données

## Quick Start

### 1. Cloner le repository
```bash
git clone https://github.com/chrlesur/csv-cleaner.git
cd csv-cleaner
```

### 2. Déploiement local

#### Option 1 : Ouvrir directement dans le navigateur
1. Naviguer dans le dossier cloné
2. Double-cliquer sur `index.html`
3. L'application s'ouvre dans votre navigateur par défaut

**Note** : Cette méthode est la plus simple mais certaines fonctionnalités peuvent être limitées à cause des restrictions CORS des navigateurs.

#### Option 2 : Utiliser VS Code Live Server
1. Installer VS Code si ce n'est pas déjà fait
2. Installer l'extension "Live Server"
   - Cliquer sur l'icône Extensions dans la barre latérale
   - Rechercher "Live Server"
   - Cliquer sur "Install"
3. Ouvrir le dossier du projet dans VS Code
4. Clic droit sur `index.html`
5. Sélectionner "Open with Live Server"
6. L'application s'ouvre automatiquement dans votre navigateur sur `http://localhost:5500`

**Avantage** : Cette méthode évite les problèmes de CORS et permet un rechargement automatique lors des modifications.

### 3. Configuration

1. Obtenir un Bearer Token Dragonfly AI
   - Se connecter sur [https://ai.dragonflygroup.fr](https://ai.dragonflygroup.fr)
   - Générer un nouveau token dans les paramètres

2. Préparer le fichier **CSV**
   - Format **UTF-8**
   - Séparateur point-virgule (;)
   - Headers requis :
     ```
     Civilité;Prénom;Nom;Nom Complet;Fonction;Email;Organisation;Téléphone
     ```

## Architecture 

### Structure des fichiers
```
project/
├── index.html          # Page principale
├── css/
│   └── style.css      # Styles CSS
├── js/
│   ├── app.js         # Application principale
│   ├── dragonflyAPI.js # Communication API
│   ├── dedup.js       # Gestion des doublons  
│   ├── security.js    # Sécurité
│   └── tokenManager.js # Gestion des tokens
```

### Composants principaux
- **App** : Gestion principale de l'application
- **DragonflyAPI** : Communication avec l'API de nettoyage
- **DedupeManager** : Détection et gestion des doublons
- **TokenManager** : Gestion sécurisée des tokens
- **SecurityLogger** : Logging sécurisé

## Fonctionnalités

### 1. Gestion des fichiers
- Import de fichiers CSV par drag & drop
- Validation du format et de l'encodage
- Prévisualisation des données

### 2. Nettoyage des données
- Normalisation des champs :
  - Civilité
  - Prénom/Nom
  - Email
  - Téléphone
  - Organisation
  - Fonction
- Scoring de confiance par champ
- Barre de progression en temps réel

### 3. Déduplication
- Détection automatique des doublons
- Interface de sélection manuelle
- Fusion intelligente des données
- Conservation de l'historique

### 4. Export
- Export au format CSV-UTF8
- Conservation des modifications
- Rapport de nettoyage inclus

## Sécurité

### Gestion des tokens
- Stockage sécurisé en mémoire
- Pas de persistance locale
- Validation automatique

### Protection des données
- Traitement local des fichiers
- Pas de stockage permanent
- Nettoyage automatique après traitement

## API

### Configuration
```javascript
const CONFIG = {
    ASSISTANT_ID: 'asst_xxx',
    API_URL: 'https://ai.dragonflygroup.fr/api',
    CSV_HEADERS: [...]
};
```

### Endpoints principaux
- `/user/assistants` : Validation token
- `/chat/completions` : Nettoyage des données

## Interface utilisateur

### Zones principales
1. **Zone Token** : Saisie et validation du Bearer token
2. **Zone Drop** : Import des fichiers CSV
3. **Zone Preview** : Visualisation des données sources
4. **Zone Results** : Affichage des données nettoyées

### Indicateurs visuels
- Code couleur par niveau de confiance
- Surbrillance des modifications
- Tooltips informatifs
- Barre de progression

## Guide d'utilisation

### 1. Démarrage
1. Ouvrir l'application selon une des méthodes du Quick Start
2. Coller le Bearer token Dragonfly
3. Attendre la validation du token

### 2. Import des données
1. Glisser-déposer un fichier CSV
2. Vérifier la prévisualisation
3. Lancer le nettoyage via le bouton

### 3. Traitement
1. Observer la progression
2. Vérifier les résultats
3. Gérer les doublons si détectés
4. Exporter le fichier nettoyé

### 4. Dépannage
- Vérifier la validité du token
- S'assurer du format CSV correct
- Consulter les logs navigateur
- Contacter le support si nécessaire

### 5. Résolution des problèmes courants

#### Le fichier n'est pas importé
- Vérifier l'encodage UTF-8
- Vérifier les headers
- Taille < 5MB

#### Token invalide
- Vérifier la validité sur [https://ai.cloud-temple.com](https://ai.cloud-temple.com)
- Générer un nouveau token
- Vérifier l'absence d'espaces

#### Erreurs de nettoyage
1. Ouvrir la console développeur (F12)
2. Vérifier les logs d'erreur
3. Copier l'erreur complète
4. Consulter la documentation API

## Limitations connues
- Taille maximum : 5MB
- Format : CSV UTF-8 uniquement
- Headers prédéfinis requis
- Connexion internet requise

## Support
Pour toute question ou assistance :
- Support technique : [ia@cloud-temple.com]
- Bugs : [github issues]

