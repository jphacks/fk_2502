import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig';

const RED = 'rgb(186, 73, 73)';

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [emName, setEmName] = useState('');
  const [emEmail, setEmEmail] = useState('');
  const [error, setError] = useState('');

  const isEmailValid = (val) => /[^@\s]+@[^@\s]+\.[^@\s]+/.test(val);

  const handleNext = () => {
    setError('');
    if (currentStep === 1) {
      if (!gender) {
        setError('Please select your gender');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const ageNum = Number(age);
      if (!age || Number.isNaN(ageNum) || ageNum < 10 || ageNum > 100) {
        setError('Please enter a valid age (10-100)');
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    setError('');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  async function handleSave() {
    setError('');
    if (!emName || !emEmail) {
      setError('Please fill in all fields');
      return;
    }
    if (!isEmailValid(emEmail)) {
      setError('Emergency contact email is invalid');
      return;
    }
    try {
      const ageNum = Number(age);
      await setDoc(doc(db, 'users', user.uid), {
        gender,
        age: ageNum,
        emergencyContactName: emName.trim(),
        emergencyContactEmail: emEmail.trim().toLowerCase(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      // Refresh the profile data to trigger navigation
      await refreshProfile();
    } catch (e) {
      console.error('Failed to save profile:', e);
      setError('Failed to save. Please try again');
    }
  }

  const renderStep1 = () => (
    <View style={styles.card}>
      <Text style={styles.title}>What's your gender?</Text>
      <View style={styles.genderOptions}>
        <TouchableOpacity 
          style={[styles.genderButton, gender === 'male' && styles.genderButtonSelected]} 
          onPress={() => setGender('male')}
        >
          <Text style={[styles.genderText, gender === 'male' && styles.genderTextSelected]}>Male</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.genderButton, gender === 'female' && styles.genderButtonSelected]} 
          onPress={() => setGender('female')}
        >
          <Text style={[styles.genderText, gender === 'female' && styles.genderTextSelected]}>Female</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.genderButton, gender === 'other' && styles.genderButtonSelected]} 
          onPress={() => setGender('other')}
        >
          <Text style={[styles.genderText, gender === 'other' && styles.genderTextSelected]}>Other</Text>
        </TouchableOpacity>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.card}>
      <Text style={styles.title}>How old are you?</Text>
      <TextInput
        placeholder="Enter your age"
        placeholderTextColor={RED}
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
        style={styles.input}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={handleBack}>
          <Text style={[styles.buttonText, styles.backButtonText]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.card}>
      <Text style={styles.title}>Emergency Contact</Text>
      <Text style={styles.subtitle}>Who should we contact in case of emergency?</Text>
      <TextInput
        placeholder="Emergency contact name"
        placeholderTextColor={RED}
        value={emName}
        onChangeText={setEmName}
        style={styles.input}
      />
      <TextInput
        placeholder="Emergency contact email"
        placeholderTextColor={RED}
        value={emEmail}
        onChangeText={setEmEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={handleBack}>
          <Text style={[styles.buttonText, styles.backButtonText]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Complete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ImageBackground
      source={require('../../assets/images/splash-icon.png')}
      resizeMode="cover"
      blurRadius={30}
      style={styles.container}
      imageStyle={styles.bgImage}
    >
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgImage: {
    opacity: 0.25,
  },
  card: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: RED,
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.7)',
    marginBottom: 24,
    textAlign: 'center',
  },
  genderOptions: {
    width: '100%',
    marginBottom: 20,
  },
  genderButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonSelected: {
    backgroundColor: RED,
    borderColor: RED,
  },
  genderText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  genderTextSelected: {
    color: '#fff',
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderColor: RED,
    borderWidth: 1,
    color: RED,
    fontSize: 16,
  },
  button: {
    backgroundColor: RED,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 0,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  backButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: RED,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  backButtonText: {
    color: RED,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  error: {
    color: RED,
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 14,
  },
});
