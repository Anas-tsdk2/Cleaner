# Documentation - Cora's CSV Cleaner v1.0

## Table des matières
1. [Introduction](#introduction)
2. [Installation](#installation)
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

## Installation

### Prérequis
- Un navigateur web moderne (Chrome, Firefox, Edge, Safari)
- Un token d'accès à l'API Dragonfly AI
- Git installé sur votre machine

### Installation du projet

1. **Cloner le projet**
   ```bash
   # Créer un dossier pour vos projets si ce n'est pas déjà fait
   mkdir Projets
   cd Projets

   # Cloner le repository
   git clone https://github.com/chrlesur/CORA.git
   cd CORA
   ```

2. **Ouvrir le projet**
   - Double-cliquer sur le fichier `index.html` dans le dossier CORA
   - L'application s'ouvre dans votre navigateur par défaut

### Configuration initiale

1. **Token Dragonfly AI**
   - Se rendre sur [https://ai.dragonflygroup.fr](https://ai.dragonflygroup.fr)
   - Connectez-vous à votre compte
   - Dans les paramètres, générer un nouveau Bearer Token
   - Copier le token pour l'utiliser dans l'application

2. **Format CSV requis**
   - Encodage : UTF-8
   - Séparateur : point-virgule (;)
   - En-têtes obligatoires :
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
- Stockage sécurisé en sessionStorage
- Pas de persistance permanente
- Validation automatique à chaque utilisation

### Protection des données
- Traitement local des fichiers
- Pas de stockage permanent
- Nettoyage automatique après traitement

## API

### Configuration
```javascript
const CONFIG = {
    ASSISTANT_ID: 'asst_1f1UeJGMURpenLfrj4Aaykyp',
    API_URL: 'https://ai.dragonflygroup.fr/api/v1',
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
- Code couleur par niveau de confiance :
  - Vert foncé : 100%
  - Vert-jaune : 90%
  - Jaune-vert : 85%
  - Orange : 50%
  - Orange-rouge : 25%
  - Rouge : Erreur
- Surbrillance des modifications
- Tooltips informatifs
- Barre de progression

## Guide d'utilisation

### 1. Démarrage
1. Ouvrir l'application
2. Coller le Bearer token Dragonfly dans la zone dédiée
3. Attendre la validation du token (indicateur vert)

### 2. Import des données
1. Glisser-déposer un fichier CSV dans la zone prévue
2. Vérifier la prévisualisation dans le tableau de gauche
3. Cliquer sur "Nettoyer les données"

### 3. Traitement
1. Observer la barre de progression
2. Vérifier les résultats dans le tableau de droite
3. Utiliser "Dédupliquer" si nécessaire
4. Exporter via "Exporter en CSV-UTF8"

### Dépannage

#### Le fichier n'est pas importé
- Vérifier l'encodage UTF-8
- Vérifier la présence de tous les headers requis
- S'assurer que le fichier fait moins de 5MB

#### Token invalide
- Vérifier la validité sur [https://ai.dragonflygroup.fr](https://ai.dragonflygroup.fr)
- Générer un nouveau token si nécessaire
- S'assurer qu'il n'y a pas d'espaces avant/après le token

#### Erreurs de nettoyage
1. Ouvrir la console développeur (F12)
2. Noter les messages d'erreur
3. Vérifier la connexion internet
4. Vérifier la validité du token

## Limitations
- Taille maximum du fichier : 5MB
- Format accepté : CSV UTF-8 uniquement
- En-têtes prédéfinis obligatoires
- Connexion internet requise
- Token Dragonfly AI requis

## Support et Contact
- Support technique : [ia@cloud-temple.com](mailto:ia@cloud-temple.com)
- Documentation API : [https://ai.dragonflygroup.fr/docs](https://ai.dragonflygroup.fr/docs)
- Bugs et suggestions : [Issues GitHub](https://github.com/chrlesur/CORA/issues)