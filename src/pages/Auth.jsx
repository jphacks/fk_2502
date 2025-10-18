import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ImageBackground } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signInWithCredential, GoogleAuthProvider, sendEmailVerification } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const RED = 'rgb(186, 73, 73)';

export default function AuthScreen() {
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEmailValid = (val) => /[^@\s]+@[^@\s]+\.[^@\s]+/.test(val);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setError('');
    try {
      setLoading(true);
      // For now, show a message that Google Sign-In needs to be configured
      setError('Google Sign-In requires additional setup. Please use email/password for now.');
    } catch (e) {
      setError(e?.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  async function handleSubmit() {
    if (loading) return;
    setError('');
    if (!isEmailValid(email)) {
      setError('Invalid email');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Please enter your name');
          return;
        }
        let cred;
        try {
          cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        } catch (e) {
          const code = e?.code || 'auth/unknown';
          if (code.includes('auth/email-already-in-use')) setError('Email already in use');
          else if (code.includes('auth/invalid-email')) setError('Invalid email');
          else if (code.includes('auth/weak-password')) setError('Weak password (min 6 chars)');
          else if (code.includes('auth/network-request-failed')) setError('Network error. Check connection.');
          else if (code.includes('auth/too-many-requests')) setError('Too many attempts. Try again later.');
          else if (code.includes('auth/operation-not-allowed')) setError('Email/password sign-in is disabled in Firebase.');
          else setError(e?.message || 'Authentication failed.');
          return;
        }

        try {
          await updateProfile(cred.user, { displayName: name.trim() });
        } catch (_) {
          // non-fatal; continue
        }

        try {
          await sendEmailVerification(cred.user);
        } catch (_) {
          // non-fatal; continue
        }

        try {
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            emailVerified: false,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.error('Failed to save user profile:', e);
          // Don't block signup, but log the error
        }
      } else {
        try {
          const result = await signInWithEmailAndPassword(auth, email.trim(), password);
          // Update last login time
          try {
            await setDoc(doc(db, 'users', result.user.uid), {
              lastLoginAt: serverTimestamp(),
            }, { merge: true });
          } catch (e) {
            console.warn('Failed to update last login time:', e);
          }
        } catch (e) {
          const code = e?.code || 'auth/unknown';
          if (code.includes('auth/invalid-email')) setError('Invalid email');
          else if (code.includes('auth/user-not-found')) setError('No user found with this email');
          else if (code.includes('auth/wrong-password')) setError('Incorrect password');
          else if (code.includes('auth/network-request-failed')) setError('Network error. Check connection.');
          else if (code.includes('auth/too-many-requests')) setError('Too many attempts. Try again later.');
          else setError(e?.message || 'Sign in failed.');
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground
      source={require('../../assets/images/splash-icon.png')}
      resizeMode="cover"
      blurRadius={30}
      style={styles.container}
      imageStyle={styles.bgImage}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{mode === 'signup' ? 'Create Account' : 'Welcome Back'}</Text>
        {mode === 'signup' && (
          <TextInput
            placeholder="Name"
            placeholderTextColor={RED}
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
        )}
        <TextInput
          placeholder="Email"
          placeholderTextColor={RED}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={RED}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} activeOpacity={0.8} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{mode === 'signup' ? 'Sign Up' : 'Sign In'}</Text>
          )}
        </TouchableOpacity>
        
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>
        
        <TouchableOpacity style={[styles.googleButton, loading && styles.buttonDisabled]} onPress={handleGoogleSignIn} activeOpacity={0.8} disabled={loading}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
          <Text style={styles.switchText}>
            {mode === 'signup' ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </View>
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
    shadowOpacity: 0.30,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: RED,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    borderColor: RED,
    borderWidth: 1,
    color: RED,
  },
  button: {
    backgroundColor: RED,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 0,
    marginTop: 12,
    shadowColor: '#000',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  error: {
    color: RED,
    marginBottom: 8,
  },
  switchText: {
    color: RED,
    marginTop: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dividerText: {
    marginHorizontal: 16,
    color: 'rgba(0,0,0,0.5)',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  googleButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
});
