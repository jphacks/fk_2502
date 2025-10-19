import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Image, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import Navigation from './navigation';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function SplashScreen() {
  const fadeAnim = new Animated.Value(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 1500); // Start fading after 1.5s

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: '#fff',
      opacity: fadeAnim
    }}>
      <Image
        source={require('../logo.png')}
        style={{ width: 200, height: 200, resizeMode: 'contain' }}
      />
    </Animated.View>
  );
}

function Gate() {
  const { user, profile, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000); // Total time: 1.5s display + 0.5s fade

    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="rgba(14, 165, 233, 0.95)" />
      </View>
    );
  }

  if (!user) return <Auth />;

  // If profile exists, user completed onboarding
  if (!profile) return <Onboarding />;

  return <Navigation />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Gate />
      </NavigationContainer>
    </AuthProvider>
  );
}

