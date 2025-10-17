import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import Navigation from './navigation';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function Gate() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="rgb(186, 73, 73)" />
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

