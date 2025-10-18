# 💊 PillPal

A medication reminder app built with React Native (Expo) and Firebase.

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/jphacks/fk_2502.git
cd fk_2502
npm install
```

### 2. Start the App

```bash
npx expo start
```

Then:
- Download **Expo Go** on your phone
- Scan the QR code on your phone

---

## 👥 Initial Task distribution 

| Person | Task |
|--------|------|
| Naura | Camera page |
| Saim | Backend/OCR |
| Chisato | Dashboard page |
| Chin | History page |
| Nazmul | Firebase setup |

---

## 📁 Project Structure

```
src/
  pages/
    Dashboard.js    ← Home screen
    Camera.js       ← Take photos
    History.js      ← Past meds
  navigation.js     ← Tab navigation
  App.js           ← Main app
```

---

## 🔀 Git Workflow (For Everyone)

### Before pushing your changes:

```bash
# Create your feature branch
git checkout -b feature/your-feature-name

# Stage your files
git add "location of your files"

# Commit with a message
git commit -m "add your comments"

# Push to remote
git push origin feature/your-feature-name
```

### After you're done:

```bash
# Switch back to main
git checkout main

# Pull latest changes
git pull origin main
```

This will ensure you are up to date with others' work.

---

## 🔥 Firebase Setup (For Saim)

### Install Firebase Tools

```bash
npm install -g firebase-tools
```

### Login & Setup

```bash
# Login to Firebase with your account
firebase login

# Use the project
firebase use your-project-id
```

### Setup Python Environment

```bash
# Navigate to functions folder
cd functions

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate   # Mac/Linux
# or venv\Scripts\activate on Windows

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Deploy Functions

```bash
firebase deploy --only functions
```

---

That's it! Start coding. 🚀
